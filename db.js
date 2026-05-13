'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'cw_sales.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Performance & integrity settings
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Schema ───────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS sales (
    id                TEXT PRIMARY KEY,
    source            TEXT DEFAULT 'Premium Investment',
    address           TEXT NOT NULL,
    suburb            TEXT,
    region            TEXT,
    classification    TEXT,
    status            TEXT DEFAULT 'Sold',
    price             REAL,
    price_guide       REAL,
    net_rent          REAL,
    outgoings         REAL,
    yld               REAL,
    date_listed       TEXT,
    sale_date         TEXT,
    settlement_date   TEXT,
    process           TEXT,
    campaign_close    TEXT,
    rc_status         TEXT,
    land_area         REAL,
    land_rate         REAL,
    floor_area        REAL,
    cap_val           REAL,
    units             REAL,
    unit_rate         REAL,
    wale              REAL,
    parking           REAL,
    configuration     TEXT,
    land_area_ha      REAL,
    land_rate_ha      REAL,
    land_area_acre    REAL,
    land_rate_acre    REAL,
    no_lots           REAL,
    lot_rate          REAL,
    perm_gfa          REAL,
    gfa_sqm           REAL,
    zoning            TEXT,
    zoning2           TEXT,
    fsr               REAL,
    height            REAL,
    approval          REAL,
    dev_stage         TEXT,
    constraints       TEXT,
    agent1            TEXT,
    agent2            TEXT,
    vendor            TEXT,
    purchaser         TEXT,
    comments          TEXT,
    analysis          TEXT,
    operator          TEXT,
    places            REAL,
    price_per_place   REAL,
    rent_per_place    REAL,
    created_at        TEXT DEFAULT (datetime('now')),
    updated_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS campaigns (
    id               TEXT PRIMARY KEY,
    address          TEXT NOT NULL,
    suburb           TEXT,
    region           TEXT,
    source           TEXT DEFAULT 'Metro',
    classification   TEXT,
    process          TEXT,
    date_listed      TEXT,
    close_date       TEXT,
    price_guide      REAL,
    net_income       REAL,
    agent1           TEXT,
    agent2           TEXT,
    vendor           TEXT,
    zoning           TEXT,
    land_area        REAL,
    notes            TEXT,
    result_notes     TEXT,
    status           TEXT DEFAULT 'active',
    sale_price       REAL,
    purchaser        TEXT,
    sold_date        TEXT,
    settlement_date  TEXT,
    source_url       TEXT,
    scrape_source    TEXT,
    last_checked     TEXT,
    created_at       TEXT,
    updated_at       TEXT
  );

  CREATE TABLE IF NOT EXISTS discoveries (
    id            TEXT PRIMARY KEY,
    type          TEXT DEFAULT 'new',
    address       TEXT,
    suburb        TEXT,
    region        TEXT,
    classification TEXT,
    price         REAL,
    price_guide   REAL,
    net_income    REAL,
    yld           REAL,
    wale          REAL,
    agent         TEXT,
    process       TEXT,
    close_date    TEXT,
    operator      TEXT,
    source_url    TEXT,
    scrape_source TEXT,
    raw_data      TEXT,
    status        TEXT DEFAULT 'pending',
    is_premium    INTEGER DEFAULT 0,
    created_at    TEXT
  );

  CREATE TABLE IF NOT EXISTS alerts (
    id          TEXT PRIMARY KEY,
    type        TEXT,
    title       TEXT,
    body        TEXT,
    link_id     TEXT,
    link_type   TEXT,
    read        INTEGER DEFAULT 0,
    created_at  TEXT
  );

  CREATE TABLE IF NOT EXISTS scrape_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    source     TEXT,
    status     TEXT,
    found      INTEGER DEFAULT 0,
    errors     TEXT,
    created_at TEXT
  );
`);

// ─── Seed data ────────────────────────────────────────────────────────────────

const SEED = [
  {
    id: 'S001',
    source: 'Metro',
    address: '16-18 McKeon Street',
    suburb: 'Maroubra',
    region: 'Eastern Suburbs',
    classification: 'Apartment Block',
    status: 'Active',
    price: null,
    net_rent: null,
    yld: null,
    land_area: 626,
    zoning: 'MU1 Mixed Use',
    fsr: 0.9,
    process: 'Auction',
    agent1: 'Ray White Double Bay',
    comments: 'Gross Income $281,060. Guiding $6,700,000.',
  },
  {
    id: 'S002',
    source: 'Metro',
    address: '22 Alison Road',
    suburb: 'Randwick',
    region: 'Eastern Suburbs',
    classification: 'Development Site',
    status: 'Active',
    price: null,
    net_rent: null,
    land_area: 835,
    zoning: 'R2 Low Density',
    agent1: 'CBRE',
  },
  {
    id: 'S003',
    source: 'Metro',
    address: '100 Crown Street',
    suburb: 'Darlinghurst',
    region: 'City Fringe',
    classification: 'Commercial',
    status: 'Sold',
    price: 3200000,
    net_rent: 128000,
    yld: 0.04,
    land_area: 210,
    agent1: 'JLL',
    sale_date: '2025-11-15',
  },
  {
    id: 'CC01',
    source: 'Premium Investment',
    address: '42 Morris Street',
    suburb: 'St Marys',
    region: 'Metro',
    classification: 'Childcare Centre',
    status: 'Sold',
    price: 10288000,
    net_rent: 540000,
    yld: 0.0525,
    wale: 15,
    agent1: 'Burgess Rawson (CBRE)',
    operator: 'Montessori',
    places: 104,
    price_per_place: 98923,
    rent_per_place: 5192,
    sale_date: '2026-03-01',
  },
  {
    id: 'CC02',
    source: 'Premium Investment',
    address: '1 Cameron Avenue',
    suburb: 'West Pennant Hills',
    region: 'Metro',
    classification: 'Childcare Centre',
    status: 'Sold',
    price: 3400000,
    net_rent: 164500,
    yld: 0.0484,
    wale: 10,
    agent1: 'Burgess Rawson (CBRE)',
    operator: 'Wonderland Academy ELC',
    places: 30,
    price_per_place: 113333,
    rent_per_place: 5483,
    sale_date: '2026-03-01',
  },
];

// Columns that exist in the sales table (used for insert)
const SALE_COLS = [
  'id','source','address','suburb','region','classification','status',
  'price','price_guide','net_rent','outgoings','yld','date_listed','sale_date',
  'settlement_date','process','campaign_close','rc_status','land_area','land_rate',
  'floor_area','cap_val','units','unit_rate','wale','parking','configuration',
  'land_area_ha','land_rate_ha','land_area_acre','land_rate_acre','no_lots','lot_rate',
  'perm_gfa','gfa_sqm','zoning','zoning2','fsr','height','approval','dev_stage',
  'constraints','agent1','agent2','vendor','purchaser','comments','analysis',
  'operator','places','price_per_place','rent_per_place',
];

const insertSaleStmt = db.prepare(
  `INSERT OR IGNORE INTO sales (${SALE_COLS.join(', ')})
   VALUES (${SALE_COLS.map(() => '?').join(', ')})`
);

function insertSale(rec) {
  const values = SALE_COLS.map(col => {
    const v = rec[col];
    return v === undefined ? null : v;
  });
  return insertSaleStmt.run(...values);
}

// Seed if empty
const rowCount = db.prepare('SELECT COUNT(*) as n FROM sales').get().n;
if (rowCount === 0) {
  const seedTx = db.transaction((records) => {
    for (const rec of records) insertSale(rec);
  });
  seedTx(SEED);
  console.log(`[db] Seeded ${SEED.length} sales records.`);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function gId() {
  return uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();
}

module.exports = { db, gId };
