'use strict';
// Guard against a whole class of bug that has bitten this app three times:
// a column added to an INSERT without its matching placeholder. SQLite only
// complains at runtime, so "Save" looks broken and the cause is a 500 buried
// in the server log.
//
// Run with: npm test
const fs = require('fs');
const path = require('path');

const FILES = ['server.js', 'db.js', 'scrapers/stonebridge.js'];
const root = path.join(__dirname, '..');

let broken = 0, checked = 0, skipped = 0;

for (const file of FILES) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) continue;
  const src = fs.readFileSync(full, 'utf8');
  const re = /INSERT(?:\s+OR\s+\w+)?\s+INTO\s+(\w+)\s*\(([\s\S]*?)\)\s*VALUES\s*\(([\s\S]*?)\)/gi;
  let m;
  while ((m = re.exec(src))) {
    const [, table, colsRaw, valsRaw] = m;
    const line = src.slice(0, m.index).split('\n').length;

    // Statements that build their column and placeholder lists from the same
    // array cannot drift, and ${...} defeats a static count anyway.
    if (colsRaw.includes('${') || valsRaw.includes('${')) { skipped++; continue; }

    const cols = colsRaw.split(',').map(s => s.trim()).filter(Boolean);
    const vals = valsRaw.split(',').map(s => s.trim()).filter(Boolean);
    checked++;
    if (cols.length !== vals.length) {
      broken++;
      console.error(`✗ ${file}:${line}  INSERT INTO ${table}`);
      console.error(`  ${cols.length} columns but ${vals.length} values`);
      const extra = cols.length > vals.length
        ? `columns with no placeholder: ${cols.slice(vals.length).join(', ')}`
        : `${vals.length - cols.length} placeholder(s) too many`;
      console.error(`  ${extra}\n`);
    }
  }
}

console.log(`${checked} INSERT statements checked (${skipped} dynamic, skipped) — ${broken} broken`);
process.exit(broken ? 1 : 0);
