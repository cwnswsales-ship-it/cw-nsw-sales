'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'sales.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY,
    address TEXT NOT NULL,
    suburb TEXT,
    region TEXT,
    asset_class TEXT,
    process TEXT,
    status TEXT DEFAULT 'Sold',
    price REAL,
    price_guide REAL,
    net_rent REAL,
    yield_percent REAL,
    wale REAL,
    land_area REAL,
    floor_area REAL,
    zoning TEXT,
    fsr TEXT,
    height_limit TEXT,
    vendor TEXT,
    purchaser TEXT,
    agent1 TEXT,
    agent2 TEXT,
    firm1 TEXT,
    firm2 TEXT,
    exchange_date TEXT,
    settlement_date TEXT,
    campaign_close_date TEXT,
    year INTEGER,
    notes TEXT,
    source_url TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tracking (
    id TEXT PRIMARY KEY,
    address TEXT NOT NULL,
    suburb TEXT,
    region TEXT,
    asset_class TEXT,
    process TEXT,
    status TEXT DEFAULT 'Active Campaign',
    price_guide REAL,
    net_rent REAL,
    estimated_yield REAL,
    vendor TEXT,
    agent1 TEXT,
    agent2 TEXT,
    firm1 TEXT,
    firm2 TEXT,
    campaign_close_date TEXT,
    expected_settlement_date TEXT,
    year INTEGER,
    notes TEXT,
    source_url TEXT,
    discovery_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS discoveries (
    id TEXT PRIMARY KEY,
    address TEXT,
    suburb TEXT,
    region TEXT,
    asset_class TEXT,
    price_guide TEXT,
    description TEXT,
    agent TEXT,
    firm TEXT,
    source TEXT,
    source_url TEXT,
    status TEXT DEFAULT 'pending',
    scraped_at TEXT DEFAULT (datetime('now')),
    reviewed_at TEXT,
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS scrape_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT,
    status TEXT,
    found INTEGER DEFAULT 0,
    added INTEGER DEFAULT 0,
    error TEXT,
    ran_at TEXT DEFAULT (datetime('now'))
  );
`);

// Seed with previous data
const seedCount = db.prepare('SELECT COUNT(*) as c FROM sales').get().c;
if (seedCount === 0) {
  const insert = db.prepare(`
    INSERT INTO sales (id, address, suburb, region, asset_class, process, status,
      price, price_guide, net_rent, yield_percent, wale, land_area, agent1, year, notes)
    VALUES (?, ?, ?, ?, ?, ?, 'Sold', ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const seed = db.transaction(() => {
    insert.run(uuidv4(), '16-18 McKeon Street', 'Maroubra', 'Eastern Suburbs', 'Residential', 'Private Treaty',
      null, 6700000, null, null, null, null, 'Ray White', 2024, 'Apartment block');
    insert.run(uuidv4(), '22 Alison Road', 'Randwick', 'Eastern Suburbs', 'Development Site', 'EOI',
      null, null, null, null, null, 835, 'CBRE', 2024, 'Development site 835sqm');
    insert.run(uuidv4(), '100 Crown Street', 'Darlinghurst', 'Eastern Suburbs', 'Commercial Office', 'Private Treaty',
      3200000, 3200000, 128000, 4.0, null, null, null, 2024, 'Commercial office');
    insert.run(uuidv4(), '42 Morris Street', 'St Marys', 'Western Sydney', 'Childcare', 'EOI',
      10288000, 10288000, 540000, 5.25, 15, null, null, 2024, 'Montessori Childcare, 104 licensed places, $98,923/place');
    insert.run(uuidv4(), '1 Cameron Avenue', 'West Pennant Hills', 'Hills District', 'Childcare', 'Private Treaty',
      3400000, 3400000, 164500, 4.84, 12, null, null, 2024, '30 licensed places, $113,333/place');
  });
  seed();
}

module.exports = db;
