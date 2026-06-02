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
      'Apartment Blocks', 'Private Treaty', null, null, null, null, null, null, null, null, 2024, 'Apartment block');
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

    // ── Market Tracker Property Sales ────────────────────────────────────────
    insSale.run(uuidv4(), '1 Lingard Street, Randwick NSW', 'Randwick', 'Eastern Suburbs', 'Commercial', null, 5300000, null, null, 623, 1499, null, null, '2024-02-01', 2024, null);
    insSale.run(uuidv4(), '14-18 Campbell Parade, Bondi Beach NSW', 'Bondi Beach', 'Eastern Suburbs', 'Development Site', null, 15000000, null, null, null, null, null, null, null, null, null);
    insSale.run(uuidv4(), '26 Hall Street, Bondi Beach NSW', 'Bondi Beach', 'Eastern Suburbs', 'Development Site', null, 17000000, null, null, 513, null, null, null, null, null, null);
    insSale.run(uuidv4(), '134-138 Campbell Parade, Bondi Beach', 'Bondi Beach', 'Eastern Suburbs', 'Commercial', null, 26000000, null, null, 417.3, null, null, null, null, null, null);
    insSale.run(uuidv4(), '287-289 New South Head Road, Edgecliff NSW', 'Edgecliff', 'Eastern Suburbs', 'Commercial Office', 'Off-Market', 26500000, null, null, 751, 1405, 'MU1 Mixed Use', '2:1', '2023-02-01', 2023, null);
    insSale.run(uuidv4(), '142-148 New South Head Road, Edgecliff NSW', 'Edgecliff', 'Eastern Suburbs', 'Development Site', 'Off-Market', 14000000, null, null, 828, null, 'MU1 Mixed Use', '1.5:1', '2021-06-01', 2021, null);
    insSale.run(uuidv4(), '138-140 New South Head Road, Edgecliff NSW', 'Edgecliff', 'Eastern Suburbs', 'Development Site', 'Off-Market', 8000000, null, null, 291, null, 'MU1 Mixed Use', '1.5:1', '2020-05-01', 2020, null);
    insSale.run(uuidv4(), '136 New South Head Road, Edgecliff NSW', 'Edgecliff', 'Eastern Suburbs', 'Development Site', 'Off-Market', 13500000, null, null, 620, null, 'MU1 Mixed Use', '1.5:1', '2021-08-01', 2021, null);
    insSale.run(uuidv4(), '2-10 Bay Street, Double Bay NSW', 'Double Bay', 'Eastern Suburbs', 'Development Site', 'EOI', 82000000, null, null, 1863, null, null, null, '2022-04-01', 2022, null);
    insSale.run(uuidv4(), '29-39 Bay Street, Double Bay NSW', 'Double Bay', 'Eastern Suburbs', 'Development Site', 'Off-Market', 83500000, null, null, 1424, null, 'E1 Local Centre', '2.5:1', '2022-01-01', 2022, null);
    insSale.run(uuidv4(), '332 New South Head Road, Double Bay NSW', 'Double Bay', 'Eastern Suburbs', 'Commercial', 'Off-Market', 9700000, null, null, 240, null, 'E1 Local Centre', '2.5:1', '2022-07-01', 2022, null);
    insSale.run(uuidv4(), '354 New South Head Road, Double Bay NSW', 'Double Bay', 'Eastern Suburbs', 'Retail', 'Off-Market', 8630000, null, null, 204, null, 'E1 Local Centre', '2.5:1', '2023-07-01', 2023, null);
    insSale.run(uuidv4(), '5 South Avenue, Double Bay NSW', 'Double Bay', 'Eastern Suburbs', 'Childcare', 'Auction', 7350000, null, null, 365, null, 'R2 Low Density', null, '2022-04-01', 2022, 'Childcare licence for 29 places');
    insSale.run(uuidv4(), '12 Cross Street, Double Bay NSW', 'Double Bay', 'Eastern Suburbs', 'Development Site', 'Off-Market', 26650000, null, null, 329, null, 'E1 Local Centre', '2.5:1', '2022-04-01', 2022, null);
    insSale.run(uuidv4(), '164-166 Edgecliff Road, Woollahra NSW', 'Woollahra', 'Eastern Suburbs', 'Retail', 'Auction', 5800000, null, null, 506, null, 'B1 Neighbourhood Centre', '1:1', '2022-09-01', 2022, '- Dual frontage mixed use property. 2 Ground floor retail shops with a 2/3bedroom residence on the upper level.');
    insSale.run(uuidv4(), '453-457 New South Head Road, Double Bay NSW', 'Double Bay', 'Eastern Suburbs', 'Retail', 'Auction', 13000000, null, null, 329, 759, 'B2 Local Centre', '2.5:1', '2022-10-01', 2022, '- 2-level commercial freehold with expired lease structures favoruing immediate renovation.');
    insSale.run(uuidv4(), '440 Edgecliff Road', 'Edgecliff', 'Eastern Suburbs', 'Development Site', 'Off-Market', 19500000, null, null, 1496, null, 'R3 Medium Density Residential', '0.75:1', '2022-09-06', 2022, null);
    insSale.run(uuidv4(), '14-16 Botany Street, Randwick NSW', 'Randwick', 'Eastern Suburbs', 'Development Site', 'EOI', 5615000, null, null, 862, null, 'R3 Medium Density Residential', '0.75:1', null, null, null);
    insSale.run(uuidv4(), '5 Botany Street, Randwick NSW', 'Randwick', 'Eastern Suburbs', 'Development Site', 'EOI', 3820000, null, null, 482, null, 'R3 Medium Density Residential', '0.9:1', '2023-06-05', 2023, null);
    insSale.run(uuidv4(), '557 Old South Head Road, Rose Bay NSW', 'Rose Bay', 'Eastern Suburbs', 'Apartment Blocks', 'Auction', 6800000, null, null, 506, null, 'R3 Medium Density', '0.9:1', '2023-01-07', 2023, '- Block of 6 x 2-bedroom units with balconies');
    insSale.run(uuidv4(), '141-155 Curlewis Street, Bondi Beach NSW', 'Bondi Beach', 'Eastern Suburbs', 'Development Site', 'Off-Market', 55250000, null, null, 1557, null, 'B2 Local Centre', '2:1', '2022-05-05', 2022, '- three mixed use one & two storey buildings. Ground floor retail and upper level residential');
    insSale.run(uuidv4(), '31 Lexington Place, Maroubra NSW', 'Maroubra', 'Eastern Suburbs', 'Retail', 'Auction', 1200000, null, null, 202, 404, 'B1 Neighbourhood Centre', '1:1', null, null, '- Shop-Top: Ground floor retail & 1 x 3-bedroom unit on the upper ground level.');
    insSale.run(uuidv4(), '181A Edgecliff Road, Woollahra NSW', 'Woollahra', 'Eastern Suburbs', 'Commercial', 'EOI', 5300000, null, null, 158, null, 'B1 Neighbourhood Centre', '1:1', null, null, '- 3 x retail shops and 4 x 2-bedroom fully furnished residential flats. Mixed-use redevelopment potential.');
    insSale.run(uuidv4(), '48 Oxford Street, Woollahra NSW', 'Woollahra', 'Eastern Suburbs', 'Commercial', 'EOI', 4500000, null, null, 377, 254.04, 'R2 Low Density Residential ', null, null, null, '- Existing Warehouse with tyre business tenant on 3 year lease with 3 year option from 2024');
    insSale.run(uuidv4(), '46 Hewlett Street, Bronte NSW', 'Bronte', 'Eastern Suburbs', 'Apartment Blocks', 'Auction', 6000000, null, null, 450, null, 'R2 Low Density', '0.5:1', null, null, '4 x 2-bedroom units, 1 bath');
    insSale.run(uuidv4(), '163 Clovelly Road, Randwick NSW', 'Randwick', 'Eastern Suburbs', 'Retail', 'Auction', 6000000, null, null, 165, null, 'B1 Neighbourhood Centre', '1:1', null, null, null);
    insSale.run(uuidv4(), '218 Coogee Bay Road', 'Coogee', 'Eastern Suburbs', 'Retail', 'Auction', 3050000, null, null, 120, null, 'B2 Local Centre', '1.5:1', null, null, 'Two level building with rear lane access with a basement');
    insSale.run(uuidv4(), '88 - 120 Clovelly Road, Randwick NSW', 'Randwick', 'Eastern Suburbs', 'Service Station', 'Auction', 8750000, null, null, 651, null, 'R3 Medium Density', '0.9:1', null, null, '- Dual tenancy Mechanic & Service Station');
    insSale.run(uuidv4(), '54 Brighton Boulevard, North Bondi NSW', 'North Bondi', 'Eastern Suburbs', 'Apartment Blocks', 'Auction', 10500000, null, null, 490, null, 'R2 Low Density', '0.5:1', '2022-09-11', 2022, 'Block of six units: 3 x two-bedroom and 3 x three-bedroom units.');
    insSale.run(uuidv4(), '126 Old South Head Road, Bellevue Hill NSW', 'Bellevue Hill', 'Eastern Suburbs', 'Apartment Blocks', 'Auction', 5500000, null, null, 368, null, 'R3 Medium Density', '1.3:1', null, null, 'Block of 7 Apartments: 6 x two bedroom & 1 x one-bedroom + Study');
    insSale.run(uuidv4(), '19 Dellview Street, Tamarama NSW', 'Tamarama', 'Eastern Suburbs', 'Development Site', 'Auction', 13000000, null, null, 493, null, 'R3 Medium Density', '0.6:1', null, null, '- block of 4 x 2-bedroom apartments.');
    insSale.run(uuidv4(), '326 Bronte Road, Waverley NSW', 'Waverley', 'Eastern Suburbs', 'Retail', 'Auction', 2725000, null, null, 152, 172, 'B2 Local Centre', '1:1', null, null, '- Retail shop plus parking at the rear, upstairs offices.');
    insSale.run(uuidv4(), '543 Old South Head Road, Rose Bay NSW', 'Rose Bay', 'Eastern Suburbs', 'Apartment Blocks', 'Auction', 4560000, null, null, 335, null, null, null, null, null, '- 4 x 2-bedroom units on a corner position');
    insSale.run(uuidv4(), '182 Clovelly Road, Randwick NSW', 'Randwick', 'Eastern Suburbs', 'Apartment Blocks', 'Auction', 5050000, null, null, 543.7, null, 'R3 Medium Density', '0.75:1', null, null, '- 4 x 2 bed strata apartments');
    insSale.run(uuidv4(), '11 Clyde Street, North Bondi NSW', 'North Bondi', 'Eastern Suburbs', 'Apartment Blocks', 'Auction', 7100000, null, null, 757, null, 'R2 Low Density', '0.5:1', null, null, '6 x 2-bedroom apartments, 1 x 1-bed apartments, 9 garages');
    insSale.run(uuidv4(), '17-19 Baden Street, Coogee NSW', 'Coogee', 'Eastern Suburbs', 'Apartment Blocks', 'Auction', 10500000, null, null, 594, null, 'R3 Medium Density', '0.9:1', null, null, '19 Baden Street: 6 x 2.5 Bedroom units | 17 Baden Street: 4 Bedroom home positioned at the rear of the property.');
    insSale.run(uuidv4(), '104 Warners Avenue, Bondi Beach NSW', 'Bondi Beach', 'Eastern Suburbs', 'Apartment Blocks', 'Auction', 7750000, null, null, 418, null, 'R3 Medium Density', '0.9:1', '2023-03-02', 2023, '4 x 2-beds/1 Bath apartments');
    insSale.run(uuidv4(), '100 Ramsgate Avenue, Bondi Beach NSW', 'Bondi Beach', 'Eastern Suburbs', 'Apartment Blocks', 'Auction', 11500000, null, null, 477, null, 'R3 Medium Density', '0.9:1', null, null, '4 x 2-Bedroom Units (Strata)');
    insSale.run(uuidv4(), '669 Old South Head Road, Vaucluse NSW', 'Vaucluse', 'Eastern Suburbs', 'Development Site', 'Auction', 9020000, null, null, 437, null, 'B4 Mixed Use', '1.5:1', null, null, 'DA Approval for seven luxury apartments: 2 x 3-Bedroom, 4 x 2-Bedroom, 1 x 1-Bedroom, with undercover parking for 9 cars. Two DA Approved Commercial Retail Shops.');
    insSale.run(uuidv4(), '31 Arcadia Street, Coogee NSW', 'Coogee', 'Eastern Suburbs', 'Development Site', 'Auction', 3360000, null, null, 209, null, 'R3 Medium Density', '0.9:1', null, null, 'DA Approved partially constructed 4 x 2-bedroom unit block.');
    insSale.run(uuidv4(), '39 Belgrave Street, Bronte NSW', 'Bronte', 'Eastern Suburbs', 'Apartment Blocks', 'Auction', 4750000, null, null, null, null, 'R2 Low Density', '0.5:1', null, null, '4 x 3-bedroom units. 2 x double tandem lock up garages.');
    insSale.run(uuidv4(), '45-51 Burnie Street, Clovelly NSW', 'Clovelly', 'Eastern Suburbs', 'Development Site', 'EOI', 7364000, null, null, 1052, null, 'R2 Low Density Residential', '0.5:1', null, null, 'Raw Development Site');
    insSale.run(uuidv4(), '222 Bronte Road, Waverley NSW', 'Waverley', 'Eastern Suburbs', 'Development Site', 'Auction', 1930000, null, null, 221, null, 'R3 Medium Density Residential', '0.9:1', '2022-05-07', 2022, 'DA approved medical centre for professional consulting rooms');
    insSale.run(uuidv4(), '30-32 Gordon Street, Randwick NSW', 'Randwick', 'Eastern Suburbs', 'Development Site', 'Auction', 3700000, null, null, 678, null, 'R3 Medium Density', '0.9:1', '2022-08-11', 2022, 'Development Site with 17.2m frontage. Two Semi Houses to be sold in One Line.');
    insSale.run(uuidv4(), '307 Clovelly Road', 'Clovelly', 'Eastern Suburbs', 'Retail', null, 2325000, null, null, 158, null, 'B1 Neighbourhood Centre', '1:1', null, null, 'Two storey-shop top with 2 residential units and rear lane acces');
    insSale.run(uuidv4(), '3a Bundarra Road, Bellevue Hill NSW', 'Bellevue Hill', 'Eastern Suburbs', 'Apartment Blocks', 'Auction', 8250000, null, null, 582, null, 'R3 Medium Density', '0.75:1', '2022-11-07', 2022, '3 x self contained whole floor residences (3 bed units + 3 Baths)');
    insSale.run(uuidv4(), '30 Bray Street, Bronte NSW', 'Bronte', 'Eastern Suburbs', 'Apartment Blocks', 'Auction', 3855000, null, null, 563, null, 'R3 Medium Density', '0.6:1', null, null, '2 x 3 bedroom residences + 2 garages');
    insSale.run(uuidv4(), '48 Belmore Road, Randwick NSW', 'Randwick', 'Eastern Suburbs', 'Strata Retail', 'Auction', 1950000, null, 4.36, 94, null, null, null, null, null, 'Telstra. Strata Retail; May 2025+5+5 year options to 2035');
    insSale.run(uuidv4(), '17 Denison Street, Bondi Junction NSW', 'Bondi Junction', 'Eastern Suburbs', 'Development Site', 'Auction', 1425000, null, null, 142, null, 'R3 Medium Density', '0.9:1', null, null, 'Vacant Block of Land');
    insSale.run(uuidv4(), '138 Queen Street, Woollahra NSW', 'Woollahra', 'Eastern Suburbs', 'Retail', 'Auction', 5650000, null, 1.5, 139, 146, 'B4 Mixed Use', '1:1', '2022-05-05', 2022, 'Pharmacy Tenant');
    insSale.run(uuidv4(), '49 Wallis Parade, North Bondi NSW', 'North Bondi', 'Eastern Suburbs', 'Apartment Blocks', 'Auction', 3900000, null, null, 227, null, 'R3 Medium Density', '0.9:1', null, null, '4 x 1-bedroom plus sunroom Strata Apartments');
    insSale.run(uuidv4(), '81 Oakley Road, North Bondi NSW', 'North Bondi', 'Eastern Suburbs', 'Apartment Blocks', 'Auction', 6225000, 155000, 2.49, 481, null, 'R3 Medium Density', '0.6:1', '2022-05-04', 2022, '4 x 2-bedroom plus sunrooms.');
    insSale.run(uuidv4(), '41 Hall Street, Bondi Beach NSW', 'Bondi Beach', 'Eastern Suburbs', 'Development Site', 'Auction', 10375000, null, null, 290, null, 'B4 Mixed Use', '2:1', null, null, 'Freehold building consisting of retail + 1st Floor commercial');
    insSale.run(uuidv4(), '53-59 Hall Street, Bondi Beach NSW', 'Bondi Beach', 'Eastern Suburbs', 'Development Site', 'EOI', 40000000, null, null, 1157, null, 'B2 Local Centre', '2:1', null, null, 'Two x 3-storey mixed use buildings. 24 m street frontage. Comprises of 2 x retail shops, 28 residential units and 18 on site car spaces.');
    insSale.run(uuidv4(), '217-221 Coogee Bay Road', 'Coogee', 'Eastern Suburbs', 'Development Site', 'Auction', 7500000, null, null, 589, null, 'B2 Local Centre', '1.5:1', '2022-12-04', 2022, '2 x retails shops + 3 x 2 Bedroom Units and 1 x1-bedroom unit.');
    insSale.run(uuidv4(), '20 Balfour Road, Rose Bay NSW', 'Rose Bay', 'Eastern Suburbs', 'Apartment Blocks', 'Auction', 7500000, null, null, 697, null, 'R3 ', '1:1', '2022-09-04', 2022, '4 x 2-Bedroom apartments');
    insSale.run(uuidv4(), '21 Imperial Avenue, Bondi NSW', 'Bondi', 'Eastern Suburbs', 'Apartment Blocks', 'Auction', 5700000, null, null, 596, null, 'R3 Medium Density', '0.6:1', null, null, '- 1900\'s two storey block of units, 4 x 2-bedroom units.');
    insSale.run(uuidv4(), '56 Campbell Parade, Bondi Beach NSW', 'Bondi Beach', 'Eastern Suburbs', 'Apartment Blocks', 'EOI', 20650000, null, null, 368, null, 'B4 Mixed Use', '3:1', '2020-12-01', 2020, '4 x 2-bedroom apartments & commercial shop (trading as a cafe).');
    insSale.run(uuidv4(), '222-234 Bondi Road & 1 Wellington Street', 'Bondi', 'Eastern Suburbs', 'Development Site', 'Auction', 16000000, null, null, 1388, null, null, '0.9:1', null, null, '7 x Commercial Shops + 7 x Residential 2-bedroom split level apartments + 4 x 2 bedroom plus sunroom apartments (separate apartment block).');
    insSale.run(uuidv4(), '29-31 Alfreda Street, Coogee NSW', 'Coogee', 'Eastern Suburbs', 'Commercial', 'Auction', 16800000, 470209.2, 2.8, 842, 2208, null, '1.5:1', '2022-01-03', 2022, null);
    insSale.run(uuidv4(), '100 Marine Parade, Maroubra NSW', 'Maroubra', 'Eastern Suburbs', 'Apartment Blocks', 'Auction', 8500000, null, null, 550, null, 'R3 Medium Density Residential', null, null, null, '6 x 2 Bedroom Apartments');
    insSale.run(uuidv4(), '141-143 Curlewis Street, Bondi NSW', 'Bondi', 'Eastern Suburbs', 'Commercial', 'Auction', 13500000, 413000, 3.06, 518, 670, null, null, null, null, null);
    insSale.run(uuidv4(), '156 Brighton Boulevard, North Bondi NSW', 'North Bondi', 'Eastern Suburbs', 'Apartment Blocks', 'Auction', 15000000, null, null, 449, 200, 'R3 Medium Density', '0.6', null, null, '2 x 3 bedroom — date unverified (recorded as 1991 in source but price inconsistent with that era)');
    insSale.run(uuidv4(), '154 Brighton Boulevard, North Bondi NSW', 'North Bondi', 'Eastern Suburbs', 'Apartment Blocks', 'Auction', 22000000, null, null, 465, 480, 'R3 Medium Density', '0.6', null, null, '6 x 2 bedroom — date unverified (recorded as 1991 in source but price inconsistent with that era)');
    insSale.run(uuidv4(), '43 Queen Street, Woollahra NSW', 'Woollahra', 'Eastern Suburbs', 'Commercial', 'EOI', 11250000, null, null, 221, 407, null, null, '2022-07-01', 2022, null);
    insSale.run(uuidv4(), '97-99 Queen Street, Woollahra NSW', 'Woollahra', 'Eastern Suburbs', 'Commercial', 'Auction', 9625000, 327500, 3.4, 405, 333.5, 'R2 Low Density', null, null, null, 'Woollahra Post Office. 3 x tenancies over two levels: Ground Floor Bonhams & Woollahra Post Office, First Floor - Sunman Walker Mallos Solicitors');
    insSale.run(uuidv4(), '234 Bronte Road, Waverley NSW', 'Waverley', 'Eastern Suburbs', 'Commercial Office', 'Auction', 6500000, null, null, 681, 465, 'B4 Mixed Use', '1:1', null, null, null);
    insSale.run(uuidv4(), '5 Imperial Avenue, Bondi NSW', 'Bondi', 'Eastern Suburbs', 'Apartment Blocks', 'Auction', 5235000, null, null, 446, null, 'R3 Medium Density', '0.6:1 ', null, null, '6 x 2 Bedroom (Strata)');
    insSale.run(uuidv4(), '27 Hall Street, Bondi Beach NSW', 'Bondi Beach', 'Eastern Suburbs', 'Development Site', 'Auction', 23000000, null, null, 593, 558, 'B4 Mixed Use', '2:1', null, null, '6 Residential apartments + 2 Ground Floor retail shops');
    insSale.run(uuidv4(), '32 Arcadia Street, Coogee NSW', 'Coogee', 'Eastern Suburbs', 'Apartment Blocks', 'Off-Market', 8200000, null, null, 405, null, 'R3 Medium Density', '0.75:1', null, null, '6 x 2 Beds');
    insSale.run(uuidv4(), '31 Dudley Street, Coogee NSW', 'Coogee', 'Eastern Suburbs', 'Apartment Blocks', 'Auction', 5150000, null, null, 455, null, 'R3 Medium Density', '0.9:1', '2021-01-09', 2021, 'Art deco block with 6 x 2 bedroom apartments');
    insSale.run(uuidv4(), '61 Oceanview Avenue, Dover Heights NSW', 'Dover Heights', 'Eastern Suburbs', 'Apartment Blocks', 'Auction', 7541000, null, null, 481, null, 'R2 Low Density', '0.5: 1', null, null, '7 x 2 Bedrooms');
    insSale.run(uuidv4(), '115 Avoca Street, Randwick NSW', 'Randwick', 'Eastern Suburbs', 'Development Site', 'EOI', 10000000, 351765, null, 813, null, 'B2 Local Centre', '2:1', null, null, '3 ground floor Retail Shops + 1 large upstairs tenanted space. Three street frontages');
    insSale.run(uuidv4(), '28 Burton Street, Randwick NSW', 'Randwick', 'Eastern Suburbs', 'Apartment Blocks', 'Auction', 4025000, null, null, 387, null, 'R3 Medium Density', '0.9:1 ', null, null, '1 x 2 Bedroom Unit + 1 x 3 bedroom Unit');
    insSale.run(uuidv4(), '8 Etham Avenue, Darling Point NSW', 'Darling Point', 'Eastern Suburbs', 'Apartment Blocks', 'EOI', 12000000, null, null, 506, 597, 'R3 Medium Density', '0.9:1 ', null, null, '6 x 2 bedrooms, 1.5 bathroom and 4 garages');
    insSale.run(uuidv4(), '9 Kenneth Street, Tamarama NSW', 'Tamarama', 'Eastern Suburbs', 'Development Site', 'Auction', 29200000, null, null, 565, null, 'R3 Medium Density', '0.6:1 ', null, null, '5 x Units with 12 m street frontage.');
    insSale.run(uuidv4(), '45 Moira Crescent, Coogee NSW', 'Coogee', 'Eastern Suburbs', 'Apartment Blocks', 'Auction', 4700000, null, null, 435, null, 'R3 Medium Density', '0.75:1 ', '2021-07-11', 2021, '2 x 3 Bedroom + 1 x 2 Bedroom (strata Titled)');
    insSale.run(uuidv4(), '10 Carlisle Street, Tamarama NSW', 'Tamarama', 'Eastern Suburbs', 'Apartment Blocks', 'Off-Market', 15000000, null, null, 612, null, 'R3 Medium Density', '0.6:1', null, null, '6 x 2 Bedroom + 3 x 1 Bedroom (all with balconies)');
    insSale.run(uuidv4(), '20 Cox Avenue, Bondi Beach NSW', 'Bondi Beach', 'Eastern Suburbs', 'Apartment Blocks', 'Auction', 12100000, null, null, 548, 398, 'R2 Low Density Residential ', '0.5:1 ', '2021-04-11', 2021, 'Four apartments: 2 x 3 Bedroom, 1 x 2 Bedroom, 1 x 1 Bedroom');
    insSale.run(uuidv4(), '30 Bennett Street, Bondi NSW', 'Bondi', 'Eastern Suburbs', 'Apartment Blocks', 'Off-Market', 13200000, null, null, 765, null, null, null, null, null, '6 x 2 Bedroom units, 2 x 3 Bedroom Units and 2 x 1 Bedroom units (Not Strata\'d)');
    insSale.run(uuidv4(), '30 Yarranabbe Road, Darling Point NSW', 'Darling Point', 'Eastern Suburbs', 'Apartment Blocks', 'Auction', 9000000, null, null, 340, 337, 'R3 Medium Density', '1:1', null, null, '2 x 3 Bedroom + 1 x 2 Bedroom');
    insSale.run(uuidv4(), '136 Carrington Road, Waverley NSW', 'Waverley', 'Eastern Suburbs', 'Apartment Blocks', 'Auction', 4910000, null, null, 769, 476, 'R3 Medium Density', '0.6:1 ', null, null, '8 x Studios, 3 x 1 Bedroom, 1 x 3 Bedroom');
    insSale.run(uuidv4(), '3 Moore Street, Bondi NSW', 'Bondi', 'Eastern Suburbs', 'Apartment Blocks', 'Auction', 5000000, null, null, 348, null, 'R3 Medium Density', '0.9:1', '2021-09-12', 2021, '6 x 2 Bedroom');
    insSale.run(uuidv4(), '225 Avoca Street, Randwick NSW', 'Randwick', 'Eastern Suburbs', 'Apartment Blocks', 'Auction', 8300000, null, null, 598, null, 'R3 Medium Density', '0.75:1', null, null, '6 x 2 Bedroom, 3 x 1 Bedroom');
    insSale.run(uuidv4(), '54 Bishops Avenue, Randwick NSW', 'Randwick', 'Eastern Suburbs', 'Apartment Blocks', 'Auction', 3800000, null, null, 335, null, null, null, null, null, '4 x 2 bedroom');
    insSale.run(uuidv4(), '346 Arden Street, Coogee NSW', 'Coogee', 'Eastern Suburbs', 'Development Site', 'Auction', 4525000, null, null, 632, 270, 'R2', '0.5', null, null, '4 x 2 bedroom');
    insSale.run(uuidv4(), '50 Old South Head Road, Vaucluse NSW', 'Vaucluse', 'Eastern Suburbs', 'Development Site', 'EOI', 7000000, null, null, 811, 642, null, null, null, null, null);
    insSale.run(uuidv4(), '1 Belmore Road, Randwick NSW', 'Randwick', 'Eastern Suburbs', 'Retail', 'Auction', 2000000, null, 4, 82, 209, null, null, '2021-12-03', 2021, 'Mixed use freehold; 1 x retail, 1 x 2-Bedroom, 1 x Commercial Office');
    insSale.run(uuidv4(), '116 & 118 Marine Parade, Maroubra NSW', 'Maroubra', 'Eastern Suburbs', 'Development Site', null, 16700000, null, null, 1226, null, 'R3', '0.9:1', null, null, null);
    insSale.run(uuidv4(), '34-36 O\'Brien Street, Bondi Beach NSW', 'Bondi Beach', 'Eastern Suburbs', 'Development Site', 'Auction', 6000000, null, null, 445, null, 'R3', '0.6:1', '2021-10-05', 2021, 'Development site - two homes sold in one line. Had concept plans - no DA.');
    insSale.run(uuidv4(), '356-366 New South Head Road, Double Bay NSW', 'Double Bay', 'Eastern Suburbs', 'Commercial', 'Auction', 21000000, 524140, 2.5, 462, 874, 'B2 Local Centre', '2.5:1', '2021-07-01', 2021, '- 4-level commercial freehold with a diversified income.');
    insSale.run(uuidv4(), '377-383 New South Head Road, Double Bay NSW', 'Double Bay', 'Eastern Suburbs', 'Commercial', 'Auction', 25500000, 1000000, 3.92, 588, 1529, 'B2', '2.5:1', null, null, 'Five storey commercial building, with double street frontage: New South Head Road & Kiaora Place.');
    insSale.run(uuidv4(), '104 Bronte Road, Bondi Junction NSW', 'Bondi Junction', 'Eastern Suburbs', 'Development Site', 'Auction', 3160000, null, null, 240, null, 'B4 ', '2:1', null, null, 'Small Existing cottage, with dual street frontage.');
    insSale.run(uuidv4(), '1 Gordon Street, Randwick NSW', 'Randwick', 'Eastern Suburbs', 'Apartment Blocks', 'Auction', 3300000, null, null, 336, null, 'R2', '0.5:1', null, null, '6 x 1 Bedroom units');
    insSale.run(uuidv4(), '256 New South Head Road, Double Bay NSW', 'Double Bay', 'Eastern Suburbs', 'Apartment Blocks', 'Auction', 6800000, null, null, 256, null, 'R3 ', null, null, null, '7 Units (1 x 2 Bedroom, 6 x 3 Bedroom)');
    insSale.run(uuidv4(), '50 Roscoe Street, Bondi Beach NSW', 'Bondi Beach', 'Eastern Suburbs', 'Apartment Blocks', 'Auction', 9110000, null, null, null, 445.6, 'R3', '0.9:1', null, null, '7 x 2 Bedroom Units and 1 x 1 Bedroom Unit');
    insSale.run(uuidv4(), '484-488 New South Head Road, Double Bay NSW', 'Double Bay', 'Eastern Suburbs', 'Apartment Blocks', 'Auction', 6500000, null, null, 281, 420, 'R3 Medium Density', '1.7:1', '2021-10-03', 2021, '6 x 2 Bedroom Units');
    insSale.run(uuidv4(), '294 & 296 Birrell Street, Bondi NSW', 'Bondi', 'Eastern Suburbs', 'Apartment Blocks', 'Auction', 19300000, null, null, 1191, null, 'R3 Medium Density', '0.9:1', null, null, '19 Units (13 x 2 Bedroom units, 6 x 1 Bedroom units)');
    insSale.run(uuidv4(), '101 Bondi Road', 'Bondi', 'Eastern Suburbs', 'Retail', 'Auction', 6070000, null, 4.85, 243, 421, 'B4 Mixed Use', null, '2021-05-03', 2021, null);
    insSale.run(uuidv4(), '92 Oxford Street, Woollahra NSW', 'Woollahra', 'Eastern Suburbs', 'Development Site', 'Auction', 5800000, null, null, 363, null, 'R3 Medium Density', null, null, null, null);
    insSale.run(uuidv4(), '4, 6, 8 Manning Road, Double Bay NSW', 'Double Bay', 'Eastern Suburbs', 'Development Site', 'Off-Market', 14000000, null, null, 576, null, 'B2 Local Centre', '2.5', '2020-02-12', 2020, null);
    insSale.run(uuidv4(), '75a Gould Street, Bondi Beach NSW', 'Bondi Beach', 'Eastern Suburbs', 'Commercial', 'EOI', 9000000, null, 3.5, 120, 240, null, null, '2020-07-11', 2020, null);
    insSale.run(uuidv4(), '286-294a Campbell Parade, North Bondi NSW', 'North Bondi', 'Eastern Suburbs', 'Commercial', 'Auction', 25400000, 687981, 2.7, 689.2, null, 'B1 ', '1', '2020-07-06', 2020, 'Le Depot. 4 x retail + 6 x resi');
    insSale.run(uuidv4(), '122 Brighton Boulevard, North Bondi NSW', 'North Bondi', 'Eastern Suburbs', 'Apartment Blocks', 'Auction', 11300000, null, null, null, null, null, null, null, null, null);
    insSale.run(uuidv4(), '27 Bellevue Road, Bellevue Hill NSW', 'Bellevue Hill', 'Eastern Suburbs', 'Retail', null, 2550000, null, null, 177, null, null, null, '2020-11-06', 2020, null);
    insSale.run(uuidv4(), '49 Mitchell Street, North Bondi NSW', 'North Bondi', 'Eastern Suburbs', 'Apartment Blocks', 'Auction', 5750000, null, null, 411, 462, null, null, null, null, null);
    insSale.run(uuidv4(), '195, 197, 199, 201, 203 O\'Sullivan Road, Bellevue Hill NSW', 'Bellevue Hill', 'Eastern Suburbs', 'Development Site', 'Off-Market', 23000000, null, null, 2000, null, 'R3', '1', '2020-08-09', 2020, null);
    insSale.run(uuidv4(), '30-36 Bay Street, Double Bay NSW', 'Double Bay', 'Eastern Suburbs', 'Development Site', 'EOI', 32760000, null, null, 1113, null, null, null, '2019-04-10', 2019, null);
    insSale.run(uuidv4(), '109-113 Macpherson Street, Bronte NSW', 'Bronte', 'Eastern Suburbs', 'Development Site', null, 10000000, null, null, 2231, null, null, null, '2019-02-04', 2019, 'Tenant: Bronte RSL');
    insSale.run(uuidv4(), '9, 11-13 Mulwarree Avenue, Randwick NSW', 'Randwick', 'Eastern Suburbs', 'Apartment Blocks', 'Auction', 11435000, null, null, 1305, 1280, null, null, null, null, null);
    insSale.run(uuidv4(), '9 Albert Street, Randwick NSW', 'Randwick', 'Eastern Suburbs', 'Apartment Blocks', 'EOI', 4000000, null, 2.93, 370, 450, null, null, null, null, '4 x 2 bed + 2 x 1 bed');
    insSale.run(uuidv4(), '22 Greenwich Road', 'Greenwich', 'North Shore', 'Apartment Blocks', 'Auction', 9560000, 450000, 4.7, null, 483, null, null, '2019-11-12', 2019, null);
    insSale.run(uuidv4(), '119-121 Alison Road, Randwick NSW', 'Randwick', 'Eastern Suburbs', 'Apartment Blocks', 'Auction', 5250000, null, null, 714, null, null, null, null, null, '4 x 2 bedroom units');
    insSale.run(uuidv4(), '10-12 Campbell Parade, Bondi Beach NSW', 'Bondi Beach', 'Eastern Suburbs', 'Apartment Blocks', null, 8500000, null, null, 208.7, null, 'B4 Mixed Use', '3:1', null, null, '6 x 1 Bedroom Units');
    insSale.run(uuidv4(), '54 Bennett Street, Bondi Beach NSW', 'Bondi Beach', 'Eastern Suburbs', 'Apartment Blocks', 'Auction', 10600000, null, null, 595, null, null, null, null, null, '9 units (2 x 3-bed, 5 x 2-bed, 2 x 1-bed)');
    insSale.run(uuidv4(), '15 O\'Brien Street, Bondi Beach NSW', 'Bondi Beach', 'Eastern Suburbs', 'Commercial', null, 4800000, null, null, 210, 205, 'B4 ', '2:1', null, null, null);
    insSale.run(uuidv4(), '112 O\'Brien Street, Bondi Beach NSW', 'Bondi Beach', 'Eastern Suburbs', 'Apartment Blocks', 'Auction', 4450000, null, null, 360, null, 'R3 Medium Density', '0.9:1 ', null, null, null);
    insSale.run(uuidv4(), '27-29 Knox Street, Double Bay NSW', 'Double Bay', 'Eastern Suburbs', 'Commercial', 'Auction', 9830000, null, null, 230, 230, 'B2', '2.5', null, null, 'Tenant: ANZ');
    insSale.run(uuidv4(), '63 Fletcher Street, Tamarama NSW', 'Tamarama', 'Eastern Suburbs', 'Development Site', 'Off-Market', 18000000, null, null, 771, 1200, null, null, null, null, null);
    insSale.run(uuidv4(), '156 Edgecliff Road, Woollahra NSW', 'Woollahra', 'Eastern Suburbs', 'Commercial', 'EOI', 25500000, 1060000, 4.16, 890, 1126, null, null, '2019-11-12', 2019, 'Tenant: PPD & Sonoma');
    insSale.run(uuidv4(), '15 Francis Street, Bondi Beach', 'Bondi Beach', 'Eastern Suburbs', 'Apartment Blocks', null, 7250000, null, 3.28, 550.1, null, null, null, '2026-04-01', 2026, '4 Units | 4 x 2-Beds with no parking on site');
    insSale.run(uuidv4(), '13 Fletcher Street, Tamarama', 'Tamarama', 'Eastern Suburbs', 'Apartment Blocks', null, 7800000, null, null, 488.1, null, null, null, '2026-04-01', 2026, '4 Units | 2 x2-Beds & 2 x 3-beds + 4 Lugs');
    insSale.run(uuidv4(), '71 Fletcher Street, Tamarama', 'Tamarama', 'Eastern Suburbs', 'Apartment Blocks', null, 12000000, null, null, 461, null, null, null, '2026-03-01', 2026, 'Block of 3 | 1 x 4-Bed + 2 x 2-Beds');
    insSale.run(uuidv4(), '11 McKeon Street, Maroubra', 'Maroubra', 'Eastern Suburbs', 'Apartment Blocks', null, 4210000, null, 3.85, 442, null, null, null, '2026-03-01', 2026, '4 x 3-Bedroom Apartments + Onsite Parking (4 car spaces)');
    insSale.run(uuidv4(), '10 Lancaster Road, Dover Heights', 'Dover Heights', 'Eastern Suburbs', 'Apartment Blocks', null, 5510000, null, 3.64, 539, null, null, null, '2026-03-01', 2026, '4 Units | 4 x 2-Bedroom Units');
    insSale.run(uuidv4(), '48 Evans Street, Bronte', 'Bronte', 'Eastern Suburbs', 'Apartment Blocks', null, 7150000, null, 4.15, 537, null, null, null, '2026-03-01', 2026, '6 Units | 6 x 2-Beds + LUGS.');
    insSale.run(uuidv4(), '93 Wentworth Street, Randwick', 'Randwick', 'Eastern Suburbs', 'Apartment Blocks', null, 7000000, null, 4.3, 585, null, null, null, '2026-02-01', 2026, '9 Units | 6 x 2-Beds + 3 x 1-Beds + LUGS');
    insSale.run(uuidv4(), '78 Alison Road, Randwick', 'Randwick', 'Eastern Suburbs', 'Apartment Blocks', null, 5800000, null, 3.61, 674, null, null, null, '2026-02-01', 2026, '5 Units | 4 x 2-Beds + 1 x 6-Bed + 3 x LUGS');
    insSale.run(uuidv4(), '3 Moore Street, Bondi', 'Bondi', 'Eastern Suburbs', 'Apartment Blocks', null, 7000000, null, 4.38, 348, null, null, null, '2026-02-01', 2026, '6 x 2-Beds + (1 LUG)');
    insSale.run(uuidv4(), '7 Blenheim Street, Randwick', 'Randwick', 'Eastern Suburbs', 'Apartment Blocks', null, 10000000, null, 3, 501.6, null, null, null, '2025-12-01', 2025, '6 x 2-Beds + LUGS');
    insSale.run(uuidv4(), '63 Mitchell Street, Bondi Beach', 'Bondi Beach', 'Eastern Suburbs', 'Apartment Blocks', null, 9021000, null, 3.08, 420.57, null, null, null, '2025-12-01', 2025, '6 x 2-Beds');
    insSale.run(uuidv4(), '4 Prospect Street, Waverley', 'Waverley', 'Eastern Suburbs', 'Apartment Blocks', null, 5000000, null, null, 348, null, null, null, '2025-12-01', 2025, '4 x 2-Beds');
    insSale.run(uuidv4(), '6A Mitchell Street, North Bondi', 'North Bondi', 'Eastern Suburbs', 'Apartment Blocks', null, 7095000, null, null, 447, null, null, null, '2025-11-01', 2025, '4 x 2-Beds');
    insSale.run(uuidv4(), '2 Ormond Street, Bondi Beach', 'Bondi Beach', 'Eastern Suburbs', 'Apartment Blocks', null, 10000000, null, null, 607, null, null, null, '2025-11-01', 2025, '1 x 3-Bed, 6 x 2-Beds, 3 x 1-Beds  + 10 Car Spaces');
    insSale.run(uuidv4(), '179 Hastings Parade, North Bondi', 'North Bondi', 'Eastern Suburbs', 'Apartment Blocks', null, 15160000, null, null, 487, null, null, null, '2025-11-01', 2025, '4 x 2-Beds, 1 x 3-Beds + 4 Car Spaces');
    insSale.run(uuidv4(), '57 Regent Street, Paddington', 'Paddington', 'Eastern Suburbs', 'Apartment Blocks', null, 11000000, null, 4.02, 429, null, null, null, '2025-10-01', 2025, '10 x 1-Beds + 2 x 2-Beds');
    insSale.run(uuidv4(), '12 Court Road, Double Bay', 'Double Bay', 'Eastern Suburbs', 'Apartment Blocks', null, 12425000, null, 3.65, 448, null, null, null, '2025-10-01', 2025, '9 x 2-Beds + 1 Car Space');
    insSale.run(uuidv4(), '5 Henrietta Street, Double Bay', 'Double Bay', 'Eastern Suburbs', 'Apartment Blocks', null, 19175000, null, null, 767, null, null, null, '2025-10-01', 2025, '7 x 2-Beds + 7 x 1-Beds + 16  Car Spaces');
    insSale.run(uuidv4(), '81-83 Henrietta Street, Waverley', 'Waverley', 'Eastern Suburbs', 'Apartment Blocks', null, 4615000, null, 3.4, 332, null, null, null, '2025-10-01', 2025, '4 x 2-Beds');
    insSale.run(uuidv4(), '102 Warners Avenue, Bondi Beach', 'Bondi Beach', 'Eastern Suburbs', 'Apartment Blocks', null, 7400000, null, 2.76, 394, null, null, null, '2025-10-01', 2025, '2 x 2-Beds + 2 x 3-Beds');
    insSale.run(uuidv4(), '21 Creer Street, Randwick', 'Randwick', 'Eastern Suburbs', 'Apartment Blocks', null, 6200000, null, null, 440, null, null, null, '2025-10-01', 2025, '5 x 2-Beds + 5 Car Spaces');
    insSale.run(uuidv4(), '117 Maroubra Road, Maroubra', 'Maroubra', 'Eastern Suburbs', 'Apartment Blocks', null, 3900000, null, 3.97, 354, null, null, null, '2025-10-01', 2025, '4 x 2-Beds');
    insSale.run(uuidv4(), '14 St Pauls Street, Randwick', 'Randwick', 'Eastern Suburbs', 'Apartment Blocks', null, 5000000, null, null, 436.3, null, null, null, '2025-10-01', 2025, '4 x 2-Beds + 2 x LUGS');
    insSale.run(uuidv4(), '74 Cowper Street, Randwick', 'Randwick', 'Eastern Suburbs', 'Apartment Blocks', null, 4900000, null, null, 546, null, null, null, '2025-09-01', 2025, '4 x 2-Beds');
    insSale.run(uuidv4(), '5 Alexander Street, Coogee', 'Coogee', 'Eastern Suburbs', 'Apartment Blocks', null, 7500000, null, null, 417, null, null, null, '2025-09-01', 2025, '3 x 2-Beds + 3 x 1-Beds + LUGS');
    insSale.run(uuidv4(), '12 Pitt Street, Randwick', 'Randwick', 'Eastern Suburbs', 'Apartment Blocks', null, 6900000, null, 3.84, 361, null, null, null, '2025-09-01', 2025, '6 x 2-Beds + 3 LUGS');
    insSale.run(uuidv4(), '55-61 Riley Street, Woolloomooloo NSW', 'Woolloomooloo', 'Eastern Suburbs', 'Commercial Office', 'Off-Market', 13500000, null, null, null, 608, 'MU1 Mixed Use', '2:1', '2024-01-01', 2024, 'Commercial freehold; three frontages & Art Deco Facade. Building features exposed internal brickwork, a pitched 6m ceiling with original steel beams, steel framed windows and timber floorboards.');
    insSale.run(uuidv4(), '63 Ann Street, Surry Hills NSW', 'Surry Hills', 'Eastern Suburbs', 'Commercial Office', 'EOI', 32250000, null, null, null, 2361, 'MU1 Mixed Use', '3.5:1', '2024-01-01', 2024, 'Originally built as a warehouse in the 1920\'s: asset underwent refurbishment in 2020. Property has three street frontages with basement parking. Currently 78% occupied with a WALE of 3.88 years and average passing rent of 989sqm gross. Advertised as offering strong rental reversion. 5.0 star NABERS rating with new end of trip facilities. The property was originally known as the Lamson Paragon Factory, the outside is a double brick.');
    insSale.run(uuidv4(), '210-212 Crown Street, Darlinghurst NSW', 'Darlinghurst', 'Eastern Suburbs', 'Commercial', 'EOI', 4320000, null, null, null, 347, 'R1 General Residential', '2:1', '2022-06-01', 2022, 'Commercial Freehold: Styled as a refurbished industrial showroom & upper level mezzanine + an attached existing 3-level, 2 bedroom terrace.');
    insSale.run(uuidv4(), '222 Liverpool Street, Darlinghurst NSW', 'Darlinghurst', 'Eastern Suburbs', 'Commercial', null, 4250000, null, null, null, 250, 'R1 General Residential', '2:1', '2021-12-01', 2021, null);
    insSale.run(uuidv4(), '52 William Street, Woolloomooloo NSW', 'Woolloomooloo', 'Eastern Suburbs', 'Commercial Office', 'Off-Market', 102300000, null, null, null, 5508, 'MU1 Mixed Use', '5:1', '2022-10-01', 2022, 'Commercial office building was purchased by Sydney Catholic Schools. The building is heritage listed with the school having submitted plans to transform it into an additional St Mary\'s campus - converting the use from commercial to educational.');
    insSale.run(uuidv4(), '256 Crown Street, Surry Hills NSW', 'Surry Hills', 'Eastern Suburbs', 'Commercial Office', 'EOI', 20357000, null, null, 512, 1168, 'MU1 Mixed Use', '5:1', '2022-09-01', 2022, 'Rare island site: Three level commercial freehold (circa 390 floor plates) with 6 (six) car parking bays. Sold with further development potential by the City of Sydney led Oxford Street Planning.');
    insSale.run(uuidv4(), '83-85 McLachlan Avenue, Darlinghurst NSW', 'Darlinghurst', 'Eastern Suburbs', 'Commercial Office', 'Auction', 10000000, null, null, 411, 682, 'B4 - Mixed Use Zoning', '2.5:1', '2022-05-01', 2022, 'Modern Commercial Building - Advertised as a turnkey opportunity with 12 (twelve) on site car spaces. Property has a existing office fitout.');
    insSale.run(uuidv4(), '100-130 Harris Street, Pyrmont NSW', 'Pyrmont', 'CBD/City', 'Commercial Office', 'Off-Market', 229300000, null, null, 7791, 26879, null, null, '2024-12-01', 2024, 'The office building is a original wool store from the 1890\'s and the property was gut renovated into a A-Grade office space over six levels, the sale also include the newer building at 130 Harris Street a modern three level  \'boutique\' building. The property has dual street frontage on both Harris Street & Pyrmont Street. The property also has 142 car spaces on title.  At the time of sale the property had a occupancy of 83% (17% vacancy), and a WALE of 4.3 years.');
    insSale.run(uuidv4(), '1-19 Hargrave Street, Darlinghurst NSW', 'Darlinghurst', 'Eastern Suburbs', 'Commercial Office', 'EOI', 39000000, null, null, 1489, 3124.3, 'MU1 Mixed Use', '5:1', '2024-07-01', 2024, 'The former Sony Music Building bought by Sydney Grammer School. The property had a NLA of 3,124.3 of adaptable office space and a Total GFA of 3,903. The warehouse conversion was seen as an opportunity to add-value, occupy or develop (STCA). The property was situated over three levels with a rooftop car park. The property had 36 metres of frontage across three street frontages. The floor plates were circa 1,250sqm - 1,300sqm per floor plate. The property also had 72 car spaces on the ground floor and rooftop which could be accessed via College Street.');
    insSale.run(uuidv4(), '223-225 Liverpool Street, Darlinghurst NSW', 'Darlinghurst', 'Eastern Suburbs', 'Commercial Office', 'Off-Market', 64500000, null, null, 1616, 4477, 'E1 - Local Centre', '2.5:1', '2024-11-01', 2024, 'The property is a heritage listed five storey office building near Sydney\'s Hyde Park. The building formerly known as Holdsworth House, is leased to co-working facility operator Hub Australia. The deal price represented a passing yield of 6.7% and a fully leased yield of 8.2%. The property has a large frontage onto Liverpool Street with a uniquq entrance and pedestrian walkway to oxford Street on title.');
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
