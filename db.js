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

// ── Seed Data ────────────────────────────────────────────────────────────────

const seedCount = db.prepare('SELECT COUNT(*) as c FROM sales').get().c;
if (seedCount === 0) {
  const insSale = db.prepare(`
    INSERT INTO sales (id, address, suburb, region, asset_class, process, status,
      price, net_rent, yield_percent, land_area, floor_area, zoning, fsr,
      exchange_date, year, notes)
    VALUES (?, ?, ?, ?, ?, ?, 'Sold', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seedSales = db.transaction(() => {
    // ── Previous records ────────────────────────────────────────────────────
    insSale.run(uuidv4(), '16-18 McKeon Street', 'Maroubra', 'Eastern Suburbs',
      'Residential', 'Private Treaty', null, null, null, null, null, null, null, null, 2024, 'Apartment block');
    insSale.run(uuidv4(), '22 Alison Road', 'Randwick', 'Eastern Suburbs',
      'Development Site', 'EOI', null, null, null, 835, null, null, null, null, 2024, 'Development site 835sqm');
    insSale.run(uuidv4(), '100 Crown Street', 'Darlinghurst', 'Eastern Suburbs',
      'Commercial Office', 'Private Treaty', 3200000, 128000, 4.0, null, null, null, null, null, 2024, 'Commercial office');
    insSale.run(uuidv4(), '42 Morris Street', 'St Marys', 'Western Sydney',
      'Childcare', 'EOI', 10288000, 540000, 5.25, null, null, null, null, null, 2024, 'Montessori Childcare, 104 licensed places, $98,923/place');
    insSale.run(uuidv4(), '1 Cameron Avenue', 'West Pennant Hills', 'Hills District',
      'Childcare', 'Private Treaty', 3400000, 164500, 4.84, null, null, null, null, null, 2024, '30 licensed places, $113,333/place');

    // ── Eastern Suburbs Retail Sales (source: Jack Moseley, CW Valuations) ─
    insSale.run(uuidv4(), '107 Queen Street', 'Woollahra', 'Eastern Suburbs',
      'Retail', 'EOI', 7550000, null, 3.83, 118.5, 204, 'MU1 Mixed Use', '1:1',
      '2025-08-01', 2025, 'Two-storey freehold retail. Fully leased — Aquel and Willomina. Net income $289,454 pa. 108 EOI enquiries. Sold to local investor.');
    insSale.run(uuidv4(), '32 Campbell Parade', 'Bondi Beach', 'Eastern Suburbs',
      'Retail', 'EOI', 6000000, null, 3.50, 237, 600, 'E1 Local Centre', '3:1',
      '2025-05-01', 2025, 'Two-storey freehold mixed-use. Ground floor retail + 3-bed residential apartment. Heritage item. Rent assessed $1,400/m² net pa.');
    insSale.run(uuidv4(), '45-47 Moncur Street', 'Woollahra', 'Eastern Suburbs',
      'Retail', 'EOI', 4000000, null, 4.14, 223, 199, 'R2 Low Density Residential', 'No set FSR',
      '2025-03-01', 2025, 'Two-level retail. Tenants: SydneySlice and Inigo Jones & Co. Below market passing rental $153,830 pa. Market rent $1,300/m² gross (GF).');
    insSale.run(uuidv4(), '58 William Street', 'Paddington', 'Eastern Suburbs',
      'Retail', 'EOI', 4650000, null, 2.29, 149, 145, 'E1 Local Centre', '1:1',
      '2024-10-01', 2024, 'Two-level mixed-use. Ground floor retail + first floor residential. Vacant possession. Market rent $1,500/m² gross (GF).');
    insSale.run(uuidv4(), '706 New South Head Road', 'Rose Bay', 'Eastern Suburbs',
      'Retail', 'EOI', 5500000, null, 3.20, 202, 194, 'E1 Local Centre', '2:1',
      '2023-10-01', 2023, 'Two-level freehold retail/commercial. Tenant on holdover. Gross income $95,481 pa plus GST.');
    insSale.run(uuidv4(), '134 Macpherson Street', 'Bronte', 'Eastern Suburbs',
      'Retail', 'EOI', 3300000, null, 3.52, 141, 165, 'E1 Local Centre', '1:1',
      '2025-08-01', 2025, 'Two-storey mixed-use. Ground floor retail pharmacy (5+5yr lease) + residential above. Income $2,000/m² ground retail.');
    insSale.run(uuidv4(), '581 Crown Street', 'Surry Hills', 'Eastern Suburbs',
      'Retail', 'EOI', 1835000, 106332, 5.80, 76, 140, 'E1 Local Centre', '1.5:1',
      '2025-10-01', 2025, 'Two-storey mixed-use. Single tenant. New 5yr lease from 1 Apr 2025. Passing net income $106,332 pa excl GST.');
    insSale.run(uuidv4(), '147 Oxford Street', 'Bondi Junction', 'Eastern Suburbs',
      'Retail', 'EOI', 3900000, null, 4.19, 158, 209, 'E2 Commercial Centre', '5:1',
      '2023-07-01', 2023, 'Two-level retail. 2 ground floor shops + 1st floor commercial. Sold to adjoining owner. Sydney Water easement impacted campaign. Market rent $1,400/m² gross.');
    insSale.run(uuidv4(), '33 St Pauls Street', 'Randwick', 'Eastern Suburbs',
      'Retail', 'EOI', 2240000, null, 3.89, 145, 150, 'E1 Neighbourhood Centre', '1:1',
      '2026-02-01', 2026, 'Two-storey mixed-use. Ground floor retail (~80sqm) + 2-bed residential (70sqm). Near Ritz Cinema, Randwick Light Rail, UNSW. Sold subject to vacant possession.');
    insSale.run(uuidv4(), '433 Crown Street', 'Surry Hills', 'Eastern Suburbs',
      'Retail', 'EOI', 3025000, null, 4.24, 151, 151, 'E1 Local Centre', '2:1',
      '2025-11-01', 2025, 'Two-storey terrace. Ground floor commercial (barbershop/coffee) + 2-bed residential. 4.3m glass frontage. Income assessed $1,000/m² ground floor retail.');
    insSale.run(uuidv4(), '358 Botany Road', 'Beaconsfield', 'Eastern Suburbs',
      'Retail', 'EOI', 2990000, null, 4.12, 195, 306, 'MU1 Mixed Use', '1.5:1',
      '2025-09-01', 2025, 'Three-storey mixed-use. Ground floor retail (Taste Texture, 5+5yr to Aug 2026) + studio apartment + 2-bed apartment. Combined passing income $91,660 pa.');
    insSale.run(uuidv4(), '5 Canberra Street', 'Randwick', 'Eastern Suburbs',
      'Retail', 'EOI', 3270000, null, 3.25, 164, 205, 'E1 Neighbourhood Centre', '1:1',
      '2025-07-01', 2025, 'Multi-level mixed-use. Ground floor commercial + 2 x 1-bed residential apartments. Dual street frontages. Recently renovated throughout.');
    insSale.run(uuidv4(), '229 Bronte Road', 'Waverley', 'Eastern Suburbs',
      'Retail', 'EOI', 3660000, null, 4.59, 290, 278, 'E1 Local Centre', '1:1',
      '2025-05-01', 2025, 'Two-level retail building. 4 tenancies. Fully leased returning $210,000 pa gross. Net rental derived with outgoings allowance.');
    insSale.run(uuidv4(), '126 & 126A Queen Street', 'Woollahra', 'Eastern Suburbs',
      'Retail', 'Private Treaty', 7635000, null, 4.30, 388, 297, 'MU1 Mixed Use', '1:1',
      '2025-12-01', 2025, 'Two adjoining allotments sold in-one-line. Ground floor retail + first floor offices/commercial. 126 sold with vacant possession; 126A sold with long-term tenant Kidstuff. Market rent $1,300/m² gross.');
    insSale.run(uuidv4(), '130-132 Coogee Bay Road', 'Coogee', 'Eastern Suburbs',
      'Retail', 'Off-Market', 7100000, null, 4.35, 601, 268, 'E1 Local Centre', '1.5:1',
      '2024-04-01', 2024, 'Strata title retail building. 2 ground floor retail shops + 2 first floor residential flats + 4 lock-up garages. Off-market sale of 4 strata lots (1-4 of SP67441). DA lodged for redevelopment (21 units).');
    insSale.run(uuidv4(), '317 Clovelly Road', 'Clovelly', 'Eastern Suburbs',
      'Retail', 'EOI', 3800000, null, 3.54, 191, 183, 'E1 Local Centre', '1:1',
      '2024-03-01', 2024, 'Three-storey mixed-use. Ground floor retail + 3 x 2-bed residential apartments. Communal rooftop terrace. Partially leased. Net passing income $134,400 pa.');
    insSale.run(uuidv4(), '398 Oxford Street', 'Paddington', 'Eastern Suburbs',
      'Retail', 'EOI', 3105000, 181500, 4.97, 130, 127, 'MU1 Mixed Use', '1:1',
      '2025-08-01', 2025, 'Single storey retail. Leased to Gorman. Passing rental $181,500 pa gross. Lease expiring in 12 months. Sale settled 10 October 2025.');
    insSale.run(uuidv4(), '294 Oxford Street', 'Paddington', 'Eastern Suburbs',
      'Retail', 'Off-Market', 2700000, null, 3.87, 130, 120, 'MU1 Mixed Use', '1:1',
      '2025-06-01', 2025, 'Two-level retail building. Ground floor retail + first floor office/amenities. Off-market transaction. Tenancy details undisclosed. Market rent $1,500/m² gross (GF).');
  });
  seedSales();
}

// ── Seed Tracking (awaiting settlement) ─────────────────────────────────────
const trackSeedCount = db.prepare('SELECT COUNT(*) as c FROM tracking').get().c;
if (trackSeedCount === 0) {
  const insTrack = db.prepare(`
    INSERT INTO tracking (id, address, suburb, region, asset_class, process, status,
      price_guide, net_rent, estimated_yield, campaign_close_date, expected_settlement_date,
      year, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const seedTracking = db.transaction(() => {
    insTrack.run(uuidv4(), '354 New South Head Road', 'Double Bay', 'Eastern Suburbs',
      'Retail', 'Off-Market', 'Exchanged - Awaiting Settlement',
      10300000, null, 3.75, '2026-02-01', null, 2026,
      'Regular shaped allotment. Two-level freehold commercial. Net lettable area 137m². Site 204m². Zoned E1 Local Centre / FSR 2:1. Rent assessed $1,200/m² net pa. Exchanged subject to settlement. Sold off market.');
    insTrack.run(uuidv4(), '238-240 Coogee Bay Road', 'Coogee', 'Eastern Suburbs',
      'Retail', 'Off-Market', 'Exchanged - Awaiting Settlement',
      11500000, 397000, 3.45, '2025-08-01', '2026-07-01', 2025,
      'Part three-level strata title retail building. 2 ground floor retail shops + 2 first floor residential flats + garages. Off-market in-one-line sale. Passing income $397,000 pa net plus GST. 11-month delayed settlement — settles July 2026.');
    insTrack.run(uuidv4(), '262 Oxford Street', 'Paddington', 'Eastern Suburbs',
      'Retail', 'EOI', 'Exchanged - Awaiting Settlement',
      3440000, null, 4.50, '2025-09-01', null, 2025,
      'Part one and two-level retail building. Open plan retail shop + 2-bed residence and studio at rear. Heritage conservation area. Zoned MU1 Mixed Use / FSR 1:1. Sub-4% gross yield. Market rent $1,000/m² gross retail. Sale subject to settlement.');
  });
  seedTracking();
}

module.exports = db;
