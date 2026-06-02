'use strict';
// Runs before server.js (via npm prestart).
// Downloads the SQLite DB from the bucket if a fresh container is detected.
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const fs   = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_PATH  = path.join(DATA_DIR, 'sales.db');

async function restore() {
  const endpoint  = process.env.BUCKET_ENDPOINT_URL;
  const bucket    = process.env.BUCKET_NAME;
  const accessKey = process.env.BUCKET_ACCESS_KEY_ID;
  const secretKey = process.env.BUCKET_SECRET_ACCESS_KEY;
  const region    = process.env.BUCKET_REGION || 'auto';

  if (!endpoint || !bucket || !accessKey || !secretKey) {
    console.log('[db-restore] No bucket config — skipping (using seed fallback)');
    return;
  }

  // Skip if DB already exists and is populated (e.g. on a volume or local dev)
  if (fs.existsSync(DB_PATH) && fs.statSync(DB_PATH).size > 16384) {
    console.log('[db-restore] DB already present, skipping download');
    return;
  }

  const s3 = new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    forcePathStyle: true,
  });

  try {
    console.log('[db-restore] Downloading database from bucket...');
    const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: 'sales.db' }));
    const chunks = [];
    for await (const chunk of res.Body) chunks.push(Buffer.from(chunk));
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DB_PATH, Buffer.concat(chunks));
    console.log(`[db-restore] Restored ${fs.statSync(DB_PATH).size} bytes from bucket`);
  } catch (e) {
    if (e.name === 'NoSuchKey' || (e.$metadata && e.$metadata.httpStatusCode === 404)) {
      console.log('[db-restore] No backup in bucket yet — will seed from JSON');
    } else {
      console.error('[db-restore] Download error:', e.message);
    }
  }
}

restore().catch(e => { console.error('[db-restore] Fatal:', e.message); });
