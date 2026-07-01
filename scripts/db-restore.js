'use strict';
// Runs before server.js (via npm prestart — Railway must start with "npm start").
// Downloads the SQLite DB from the bucket if a fresh container is detected, and
// ALWAYS downloads the JSON snapshot so applySeed() can merge back any rows the
// raw DB file copy missed (INSERT OR IGNORE + deletions table make this safe).
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const fs   = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_PATH   = path.join(DATA_DIR, 'sales.db');
const SEED_PATH = path.join(DATA_DIR, 'latest_seed.json');

async function download(s3, bucket, key) {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const chunks = [];
  for await (const chunk of res.Body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function isNotFound(e) {
  return e.name === 'NoSuchKey' || (e.$metadata && e.$metadata.httpStatusCode === 404);
}

async function restore() {
  const endpoint  = process.env.BUCKET_ENDPOINT_URL;
  const bucket    = process.env.BUCKET_NAME;
  const accessKey = process.env.BUCKET_ACCESS_KEY_ID;
  const secretKey = process.env.BUCKET_SECRET_ACCESS_KEY;
  const region    = process.env.BUCKET_REGION || 'auto';

  if (!endpoint || !bucket || !accessKey || !secretKey) {
    console.log('[db-restore] No bucket config — skipping (will use committed seed)');
    return;
  }

  const s3 = new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    forcePathStyle: true,
    maxAttempts: 2,
    // Never let a dead bucket endpoint stall server startup
    requestHandler: { connectionTimeout: 5000, requestTimeout: 20000 },
    // Some S3-compatible providers reject the newer SDK's default CRC32 checksums
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  // ── Primary: restore the SQLite DB file (skip if a live DB already exists,
  //    e.g. local dev or a mounted Railway volume — never clobber newer data) ──
  if (fs.existsSync(DB_PATH) && fs.statSync(DB_PATH).size > 16384) {
    console.log('[db-restore] DB already present and populated — keeping it');
  } else {
    try {
      console.log('[db-restore] Downloading sales.db from bucket...');
      const buf = await download(s3, bucket, 'sales.db');
      fs.writeFileSync(DB_PATH, buf);
      console.log(`[db-restore] ✓ Restored sales.db (${buf.length} bytes)`);
    } catch (e) {
      if (isNotFound(e)) console.log('[db-restore] No sales.db in bucket yet');
      else console.error('[db-restore] ✗ sales.db download error:', e.message);
    }
  }

  // ── Always: fetch the JSON snapshot. applySeed() merges it on boot with
  //    INSERT OR IGNORE (deletions respected), so this heals any rows missing
  //    from the DB file — regardless of how the DB got here. ─────────────────
  try {
    console.log('[db-restore] Downloading seed_backup.json from bucket...');
    const json = (await download(s3, bucket, 'seed_backup.json')).toString('utf8');
    const parsed = JSON.parse(json); // validate before writing
    const counts = {
      sales: (parsed.sales || []).length,
      tracking: (parsed.tracking || []).length,
      portfolio: (parsed.portfolio_listings || []).length,
    };
    fs.writeFileSync(SEED_PATH, json);
    console.log(`[db-restore] ✓ Snapshot saved — sales:${counts.sales} tracking:${counts.tracking} portfolio:${counts.portfolio} (merged on boot)`);
  } catch (e) {
    if (isNotFound(e)) console.log('[db-restore] No seed_backup.json in bucket — will use committed seed');
    else console.error('[db-restore] ✗ seed_backup.json download error:', e.message);
  }
}

restore().catch(e => { console.error('[db-restore] Fatal:', e.message); });
