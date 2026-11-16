'use strict';
// Export every table to a single self-describing JSON file, and import one back.
//
//   node scripts/export-all.js                    → exports/cw-nsw-sales-<date>.json
//   node scripts/export-all.js path/to/file.json  → exports to that path
//   node scripts/export-all.js --import file.json → loads a file back into the DB
//
// The export carries the column list for every table alongside the rows, so a
// file taken today still loads after new columns are added: import matches on
// column name and ignores anything the current schema does not have.

const fs   = require('fs');
const path = require('path');
const db   = require('../db.js');

const TABLES = ['sales', 'tracking', 'portfolio_listings', 'discoveries',
                'portfolio_scans', 'deletions', 'fixups_applied', 'scrape_log'];

function columnsOf(table) {
  try { return db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name); }
  catch (e) { return null; }
}

function exportAll(outPath) {
  const tables = {};
  const counts = {};
  for (const t of TABLES) {
    const cols = columnsOf(t);
    if (!cols || !cols.length) continue;            // table not in this schema
    const rows = db.prepare(`SELECT * FROM ${t}`).all();
    tables[t] = { columns: cols, rows };
    counts[t] = rows.length;
  }
  const payload = {
    format: 'cw-nsw-sales-export',
    version: 1,
    exported_at: new Date().toISOString(),
    source: process.env.RAILWAY_ENVIRONMENT ? 'production' : 'local',
    counts,
    tables,
  };
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
  const mb = (fs.statSync(outPath).size / 1048576).toFixed(2);
  console.log(`Exported to ${outPath} (${mb} MB)`);
  for (const [t, n] of Object.entries(counts)) console.log(`  ${t.padEnd(20)} ${n}`);
  return payload;
}

function importAll(inPath) {
  const payload = JSON.parse(fs.readFileSync(inPath, 'utf8'));
  if (payload.format !== 'cw-nsw-sales-export') {
    throw new Error(`Not a cw-nsw-sales export file: ${inPath}`);
  }
  console.log(`Importing ${inPath} (exported ${payload.exported_at}, source: ${payload.source})`);
  let total = 0, skippedCols = new Set();
  for (const [table, { columns, rows }] of Object.entries(payload.tables)) {
    const live = columnsOf(table);
    if (!live) { console.log(`  ${table}: table does not exist here — skipped`); continue; }
    // Only carry columns this schema still has; note the rest rather than failing.
    const use = columns.filter(c => live.includes(c));
    columns.filter(c => !live.includes(c)).forEach(c => skippedCols.add(`${table}.${c}`));
    if (!use.length || !rows.length) continue;
    const stmt = db.prepare(
      `INSERT OR REPLACE INTO ${table} (${use.join(',')}) VALUES (${use.map(() => '?').join(',')})`);
    db.transaction(() => {
      for (const r of rows) stmt.run(use.map(c => r[c] ?? null));
    })();
    console.log(`  ${table.padEnd(20)} ${rows.length} rows`);
    total += rows.length;
  }
  if (skippedCols.size) console.log(`  columns not in this schema, ignored: ${[...skippedCols].join(', ')}`);
  console.log(`Imported ${total} rows.`);
}

const args = process.argv.slice(2);
if (args[0] === '--import') {
  if (!args[1]) { console.error('Usage: node scripts/export-all.js --import <file.json>'); process.exit(1); }
  importAll(args[1]);
} else {
  const stamp = new Date().toISOString().slice(0, 10);
  exportAll(args[0] || path.join(__dirname, '..', 'exports', `cw-nsw-sales-${stamp}.json`));
}
