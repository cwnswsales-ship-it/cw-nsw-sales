'use strict';
const express = require('express');
const cors    = require('cors');
const path    = require('path');

// ── Startup ────────────────────────────────────────────────────────────────
try {
  require('./db');
  console.log('✓ Database initialised');
} catch (e) {
  console.error('✗ Database failed to initialise:', e.message);
  process.exit(1);
}

try {
  require('./seed')();
  console.log('✓ Seed check complete');
} catch (e) {
  console.error('✗ Seed failed (non-fatal):', e.message);
}

// ── Express ────────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/developers', require('./routes/developers'));
app.use('/api/projects',   require('./routes/projects'));
app.use('/api/contacts',   require('./routes/contacts'));
app.use('/api/intel',      require('./routes/intel'));
app.use('/api/scraped',    require('./routes/scraped'));
app.use('/api/settings',   require('./routes/settings'));

app.get('/api/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

const PUBLIC = path.join(__dirname, '..', 'public');
app.use(express.static(PUBLIC));
app.get('*', (_req, res) => res.sendFile(path.join(PUBLIC, 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  CW Developer Intelligence CRM`);
  console.log(`  Running on port ${PORT}\n`);
});

process.on('uncaughtException', err => {
  console.error('Uncaught exception:', err.message);
  process.exit(1);
});
