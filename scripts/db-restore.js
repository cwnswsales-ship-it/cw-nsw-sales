'use strict';
// Runs before server.js (via npm prestart).
// Downloads the SQLite DB from the bucket if a fresh container is detected.
// Falls back to a JSON snapshot (seed_backup.json) if the DB file isn't available.
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const fs   = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_PATH   = path.join(DATA_DIR, 'sales.db');
const SEED_PATH = path.join(DATA_DIR, 'latest_seed.json');

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

  // Skip if DB already exists and is populated (local dev / Railway volume)
  if (fs.existsSync(DB_PATH) && fs.statSync(DB_PATH).size > 16384) {
    console.log('[db-restore] DB already present and populated, skipping download');
    return;
  }

  const s3 = new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    forcePathStyle: true,
  });

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  // ── Primary: restore the SQLite DB file ─────────────────────────────────────
  let dbRestored = false;
  try {
    console.log('[db-restore] Downloading sales.db from bucket...');
    const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: 'sales.db' }));
    const chunks = [];
    for await (const chunk of res.Body) chunks.push(Buffer.from(chunk));
    fs.writeFileSync(DB_PATH, Buffer.concat(chunks));
    console.log(`[db-restore] ✓ Restored sales.db (${fs.statSync(DB_PATH).size} bytes)`);
    dbRestored = true;
  } catch (e) {
    if (e.name === 'NoSuchKey' || (e.$metadata && e.$metadata.httpStatusCode === 404)) {
      console.log('[db-restore] No sales.db in bucket yet — trying JSON snapshot fallback');
    } else {
      console.error('[db-restore] sales.db download error:', e.message, '— trying JSON snapshot fallback');
    }
  }

  if (dbRestored) return;

  // ── Fallback: restore from JSON snapshot (seed_backup.json) ─────────────────
  try {
    console.log('[db-restore] Downloading seed_backup.json from bucket...');
    const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: 'seed_backup.json' }));
    const chunks = [];
    for await (const chunk of res.Body) chunks.push(Buffer.from(chunk));
    const json = Buffer.concat(chunks).toString('utf8');
    // Validate it's parseable before writing
    const parsed = JSON.parse(json);
    const counts = {
      sales: (parsed.sales || []).length,
      tracking: (parsed.tracking || []).length,
      portfolio: (parsed.portfolio_listings || []).length,
    };
    fs.writeFileSync(SEED_PATH, json);
    console.log(`[db-restore] ✓ JSON snapshot saved as latest_seed.json — sales:${counts.sales} tracking:${counts.tracking} portfolio:${counts.portfolio}`);
  } catch (e) {
    if (e.name === 'NoSuchKey' || (e.$metadata && e.$metadata.httpStatusCode === 404)) {
      console.log('[db-restore] No seed_backup.json in bucket — will use committed seed file');
    } else {
      console.error('[db-restore] seed_backup.json download error:', e.message);
    }
  }
}

restore().catch(e => { console.error('[db-restore] Fatal:', e.message); });
