'use strict';
const express = require('express');
const cors    = require('cors');
const path    = require('path');

// Initialise DB (runs schema migrations on first boot)
require('./db');

// Auto-seed sample data on first boot if database is empty
require('./seed')();

const app = express();
app.use(cors());
app.use(express.json());

// ── API routes ─────────────────────────────────────────────────────────────
app.use('/api/developers', require('./routes/developers'));
app.use('/api/projects',   require('./routes/projects'));
app.use('/api/contacts',   require('./routes/contacts'));
app.use('/api/intel',      require('./routes/intel'));
app.use('/api/scraped',    require('./routes/scraped'));
app.use('/api/settings',   require('./routes/settings'));

// ── Serve frontend ─────────────────────────────────────────────────────────
const PUBLIC = path.join(__dirname, '..', 'public');
app.use(express.static(PUBLIC));

// SPA fallback — all non-API GETs serve index.html
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(PUBLIC, 'index.html'));
});

// ── Health check ───────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  CW Developer Intelligence CRM`);
  console.log(`  ──────────────────────────────`);
  console.log(`  http://localhost:${PORT}\n`);
});
