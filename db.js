'use strict';

const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');

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
    wale REAL,
    land_area REAL,
    floor_area REAL,
    zoning TEXT,
    fsr TEXT,
    height_limit TEXT,
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

  CREATE TABLE IF NOT EXISTS portfolio_listings (
    id TEXT PRIMARY KEY,
    portfolio TEXT,
    tenant TEXT,
    address TEXT,
    suburb TEXT,
    state TEXT DEFAULT 'NSW',
    asset_class TEXT,
    net_rent REAL,
    price_guide REAL,
    yield_percent REAL,
    wale REAL,
    land_area REAL,
    floor_area REAL,
    auction_date TEXT,
    auction_location TEXT,
    agent1 TEXT,
    firm1 TEXT,
    agent2 TEXT,
    firm2 TEXT,
    status TEXT DEFAULT 'Active',
    result_price REAL,
    tracking_id TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);

module.exports = db;

// Add region column to portfolio_listings if it doesn't exist yet (safe on existing DBs)
try { db.exec('ALTER TABLE portfolio_listings ADD COLUMN region TEXT'); } catch(e) {}
