'use strict';

const ExcelJS     = require('exceljs');
const express     = require('express');
const cors        = require('cors');
const compression = require('compression');
const path        = require('path');
const crypto      = require('crypto');
const fs          = require('fs');
const { v4: uuidv4 } = require('uuid');
const db          = require('./db');

let anthropic = null;
try {
  const Anthropic = require('@anthropic-ai/sdk');
  if (process.env.ANTHROPIC_API_KEY) {
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
} catch(e) { /* SDK not installed yet */ }

// ── Persistent storage paths ──────────────────────────────────────────────────
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const IM_DIR   = path.join(DATA_DIR, 'ims');
if (!fs.existsSync(IM_DIR)) fs.mkdirSync(IM_DIR, { recursive: true });

const app  = express();
const PORT = process.env.PORT || 3000;
const APP_PASSWORD = process.env.APP_PASSWORD || 'CW@Investment2025';
const APP_SECRET   = process.env.APP_SECRET   || 'cw-nsw-sales-secret-key-2025';

app.use(compression());
app.use(cors());
app.use(express.json({ limit: '30mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Auth ─────────────────────────────────────────────────────────────────────

function generateToken() {
  const timestamp = Date.now();
  const hash = crypto.createHmac('sha256', APP_SECRET)
    .update(`auth:${timestamp}`)
    .digest('hex');
  return Buffer.from(JSON.stringify({ timestamp, hash })).toString('base64url');
}

function validateToken(token) {
  if (!token) return false;
  try {
    const { timestamp, hash } = JSON.parse(Buffer.from(token, 'base64url').toString());
    if (Date.now() - timestamp > 7 * 24 * 60 * 60 * 1000) return false; // 7-day expiry
    const expected = crypto.createHmac('sha256', APP_SECRET)
      .update(`auth:${timestamp}`)
      .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expected));
  } catch {
    return false;
  }
}

function requireAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (validateToken(token)) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

app.get('/health', (req, res) => res.json({ ok: true }));

app.post('/api/auth/login', (req, res) => {
  const { password } = req.body || {};
  if (!password || password !== APP_PASSWORD) {
    return res.status(401).json({ error: 'Invalid password' });
  }
  res.json({ token: generateToken() });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ ok: true });
});

// ── Stats ─────────────────────────────────────────────────────────────────────

app.get('/api/stats', requireAuth, (req, res) => {
  const totalSales     = db.prepare("SELECT COUNT(*) as c FROM sales").get().c;
  const totalVolume    = db.prepare("SELECT SUM(price) as v FROM sales WHERE price IS NOT NULL").get().v || 0;
  const avgYield       = db.prepare("SELECT AVG(yield_percent) as y FROM sales WHERE yield_percent IS NOT NULL AND yield_percent > 0 AND yield_percent < 20").get().y;
  const totalActive    = db.prepare("SELECT COUNT(*) as c FROM tracking WHERE status NOT IN ('Converted to Sale','Withdrawn')").get().c;
  const closingThisWeek = db.prepare(
    "SELECT COUNT(*) as c FROM tracking WHERE status NOT IN ('Converted to Sale','Withdrawn') AND campaign_close_date BETWEEN date('now') AND date('now','+7 days')"
  ).get().c;

  const notableSales   = db.prepare(`
    SELECT id, address, suburb, asset_class, process, price, yield_percent,
           agent1, firm1, exchange_date, year
    FROM sales ORDER BY year DESC, COALESCE(price,0) DESC, created_at DESC LIMIT 8
  `).all();

  const upcomingCloses = db.prepare(`
    SELECT id, address, suburb, asset_class, process, price_guide, estimated_yield,
           agent1, firm1, vendor, campaign_close_date, status
    FROM tracking
    WHERE status NOT IN ('Converted to Sale','Withdrawn')
      AND campaign_close_date IS NOT NULL
      AND campaign_close_date >= date('now','-1 day')
      AND campaign_close_date <= date('now','+14 days')
    ORDER BY campaign_close_date ASC LIMIT 10
  `).all();

  const trackingByStatus = db.prepare(
    "SELECT status, COUNT(*) as count FROM tracking WHERE status != 'Converted to Sale' GROUP BY status ORDER BY count DESC"
  ).all();

  const byAsset = db.prepare(
    "SELECT asset_class, COUNT(*) as count FROM sales WHERE asset_class IS NOT NULL GROUP BY asset_class ORDER BY count DESC LIMIT 8"
  ).all();

  res.json({ totalSales, totalVolume, avgYield, totalActive, closingThisWeek, notableSales, upcomingCloses, trackingByStatus, byAsset });
});

// ── Sales ─────────────────────────────────────────────────────────────────────

app.get('/api/sales', requireAuth, (req, res) => {
  const { search, asset_class, process, status, years, region, suburb } = req.query;
  let sql = 'SELECT * FROM sales WHERE 1=1';
  const params = [];

  if (search) {
    sql += ' AND (address LIKE ? OR suburb LIKE ? OR vendor LIKE ? OR purchaser LIKE ? OR agent1 LIKE ? OR agent2 LIKE ? OR notes LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s, s, s, s);
  }
  if (asset_class) { sql += ' AND asset_class = ?'; params.push(asset_class); }
  if (process)     { sql += ' AND process = ?'; params.push(process); }
  if (status)      { sql += ' AND status = ?'; params.push(status); }
  if (region)      { sql += ' AND region = ?'; params.push(region); }
  if (suburb)      { sql += ' AND LOWER(suburb) LIKE ?'; params.push(`%${suburb.toLowerCase()}%`); }

  if (years) {
    const yearList = (Array.isArray(years) ? years : years.split(',')).map(Number).filter(Boolean);
    if (yearList.length) {
      sql += ` AND year IN (${yearList.map(() => '?').join(',')})`;
      params.push(...yearList);
    }
  }

  sql += ' ORDER BY created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

app.post('/api/sales', requireAuth, (req, res) => {
  const body = req.body;
  const id = uuidv4();
  const year = body.year || (body.exchange_date ? new Date(body.exchange_date).getFullYear() : new Date().getFullYear());
  db.prepare(`
    INSERT INTO sales (id, address, suburb, region, asset_class, process, status,
      price, price_guide, net_rent, yield_percent, wale, land_area, floor_area,
      zoning, fsr, height_limit, vendor, purchaser, agent1, agent2, firm1, firm2,
      exchange_date, settlement_date, campaign_close_date, year, notes, source_url)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(id, body.address, body.suburb, body.region, body.asset_class, body.process,
    body.status || 'Sold', body.price, body.price_guide, body.net_rent,
    body.yield_percent, body.wale, body.land_area, body.floor_area, body.zoning,
    body.fsr, body.height_limit, body.vendor, body.purchaser, body.agent1, body.agent2,
    body.firm1, body.firm2, body.exchange_date, body.settlement_date,
    body.campaign_close_date, year, body.notes, body.source_url);
  backupDb().catch(() => {});
  res.json(db.prepare('SELECT * FROM sales WHERE id = ?').get(id));
});

app.put('/api/sales/:id', requireAuth, (req, res) => {
  const body = req.body;
  const year = body.year || (body.exchange_date ? new Date(body.exchange_date).getFullYear() : undefined);
  db.prepare(`
    UPDATE sales SET address=?, suburb=?, region=?, asset_class=?, process=?, status=?,
      price=?, price_guide=?, net_rent=?, yield_percent=?, wale=?, land_area=?, floor_area=?,
      zoning=?, fsr=?, height_limit=?, vendor=?, purchaser=?, agent1=?, agent2=?, firm1=?, firm2=?,
      exchange_date=?, settlement_date=?, campaign_close_date=?, year=?, notes=?, source_url=?,
      updated_at=datetime('now')
    WHERE id=?
  `).run(body.address, body.suburb, body.region, body.asset_class, body.process, body.status || 'Sold',
    body.price, body.price_guide, body.net_rent, body.yield_percent, body.wale,
    body.land_area, body.floor_area, body.zoning, body.fsr, body.height_limit,
    body.vendor, body.purchaser, body.agent1, body.agent2, body.firm1, body.firm2,
    body.exchange_date, body.settlement_date, body.campaign_close_date, year,
    body.notes, body.source_url, req.params.id);
  backupDb().catch(() => {});
  res.json(db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id));
});

app.delete('/api/sales/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM sales WHERE id = ?').run(req.params.id);
  // Record the deletion so a redeploy/reseed never resurrects it
  db.prepare("INSERT OR REPLACE INTO deletions (id, table_name) VALUES (?, 'sales')").run(req.params.id);
  backupDb().catch(() => {});
  res.json({ ok: true });
});

// ── Tracking ──────────────────────────────────────────────────────────────────

app.get('/api/tracking', requireAuth, (req, res) => {
  const { search, asset_class, process, status, years, region, suburb } = req.query;
  let sql = "SELECT * FROM tracking WHERE status != 'Converted to Sale'";
  const params = [];

  if (search) {
    sql += ' AND (address LIKE ? OR suburb LIKE ? OR vendor LIKE ? OR agent1 LIKE ? OR agent2 LIKE ? OR notes LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s, s, s);
  }
  if (asset_class) { sql += ' AND asset_class = ?'; params.push(asset_class); }
  if (process)     { sql += ' AND process = ?'; params.push(process); }
  if (status)      { sql += ' AND status = ?'; params.push(status); }
  if (region)      { sql += ' AND region = ?'; params.push(region); }
  if (suburb)      { sql += ' AND LOWER(suburb) LIKE ?'; params.push(`%${suburb.toLowerCase()}%`); }

  if (years) {
    const yearList = (Array.isArray(years) ? years : years.split(',')).map(Number).filter(Boolean);
    if (yearList.length) {
      sql += ` AND year IN (${yearList.map(() => '?').join(',')})`;
      params.push(...yearList);
    }
  }

  sql += ' ORDER BY created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

app.post('/api/tracking', requireAuth, (req, res) => {
  const body = req.body;
  // Block duplicates: same street number + name with a compatible suburb
  const existing = db.prepare("SELECT * FROM tracking WHERE status != 'Converted to Sale'").all()
    .find(t => trackDupKey(t) === trackDupKey(body) && suburbsCompatible(t, body));
  if (existing && !body.force) {
    return res.json({ duplicate: true, existing });
  }
  const id = uuidv4();
  const year = body.year || new Date().getFullYear();
  db.prepare(`
    INSERT INTO tracking (id, address, suburb, region, asset_class, process, status,
      price_guide, net_rent, estimated_yield, wale, land_area, floor_area, zoning, fsr, height_limit,
      vendor, purchaser, agent1, agent2, firm1, firm2,
      campaign_close_date, exchange_date, expected_settlement_date, year, notes, source_url, discovery_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(id, body.address, body.suburb, body.region, body.asset_class, body.process,
    body.status || 'Active Campaign', body.price_guide, body.net_rent, body.estimated_yield,
    body.wale, body.land_area, body.floor_area, body.zoning, body.fsr, body.height_limit,
    body.vendor, body.purchaser, body.agent1, body.agent2, body.firm1, body.firm2,
    body.campaign_close_date, body.exchange_date, body.expected_settlement_date, year,
    body.notes, body.source_url, body.discovery_id || null);
  const row = db.prepare('SELECT * FROM tracking WHERE id = ?').get(id);
  backupDb().catch(() => {});
  res.json(row);
});

app.put('/api/tracking/:id', requireAuth, (req, res) => {
  const body = req.body;
  const year = body.year || undefined;
  db.prepare(`
    UPDATE tracking SET address=?, suburb=?, region=?, asset_class=?, process=?, status=?,
      price_guide=?, net_rent=?, estimated_yield=?, wale=?, land_area=?, floor_area=?,
      zoning=?, fsr=?, height_limit=?,
      vendor=?, purchaser=?, agent1=?, agent2=?, firm1=?, firm2=?,
      campaign_close_date=?, exchange_date=?, expected_settlement_date=?, year=?, notes=?, source_url=?,
      updated_at=datetime('now')
    WHERE id=?
  `).run(body.address, body.suburb, body.region, body.asset_class, body.process,
    body.status || 'Active Campaign', body.price_guide, body.net_rent, body.estimated_yield,
    body.wale, body.land_area, body.floor_area, body.zoning, body.fsr, body.height_limit,
    body.vendor, body.purchaser, body.agent1, body.agent2, body.firm1, body.firm2,
    body.campaign_close_date, body.exchange_date, body.expected_settlement_date, year,
    body.notes, body.source_url, req.params.id);
  backupDb().catch(() => {});
  res.json(db.prepare('SELECT * FROM tracking WHERE id = ?').get(req.params.id));
});

app.get('/api/tracking/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM tracking WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

app.patch('/api/tracking/:id/status', requireAuth, (req, res) => {
  const { status } = req.body || {};
  if (!status) return res.status(400).json({ error: 'status required' });
  db.prepare("UPDATE tracking SET status=?, updated_at=datetime('now') WHERE id=?").run(status, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/tracking/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM tracking WHERE id = ?').run(req.params.id);
  db.prepare("INSERT OR REPLACE INTO deletions (id, table_name) VALUES (?, 'tracking')").run(req.params.id);
  backupDb().catch(() => {});
  res.json({ ok: true });
});

// Convert tracking → sale (settlement complete)
// Every field falls back to the tracked record so the user only needs to supply
// the final sale price and settlement date — everything captured during the
// campaign / "Exchanged - Pending Settlement" stage carries over automatically.
app.post('/api/tracking/:id/sell', requireAuth, (req, res) => {
  const tracked = db.prepare('SELECT * FROM tracking WHERE id = ?').get(req.params.id);
  if (!tracked) return res.status(404).json({ error: 'Not found' });
  const body = req.body;
  const saleId = uuidv4();

  // pick(bodyVal, trackedVal): use what's typed in the sell form, else the tracked value
  const pick = (b, t) => (b !== undefined && b !== null && b !== '') ? b : (t ?? null);

  const price        = pick(body.price, null);
  const net_rent     = pick(body.net_rent, tracked.net_rent);
  const wale         = pick(body.wale, tracked.wale);
  const land_area    = pick(body.land_area, tracked.land_area);
  const floor_area   = pick(body.floor_area, tracked.floor_area);
  const purchaser    = pick(body.purchaser, tracked.purchaser);
  const exchange_date = pick(body.exchange_date, tracked.exchange_date);
  // Yield: prefer typed value, then tracked est. yield, then calc from price + net rent
  let yield_percent  = pick(body.yield_percent, tracked.estimated_yield);
  if ((yield_percent === null || yield_percent === '') && price > 0 && net_rent > 0) {
    yield_percent = Math.round((net_rent / price) * 10000) / 100;
  }
  const year = body.year || (exchange_date ? new Date(exchange_date).getFullYear() : new Date().getFullYear());

  db.prepare(`
    INSERT INTO sales (id, address, suburb, region, asset_class, process, status,
      price, price_guide, net_rent, yield_percent, wale, land_area, floor_area,
      zoning, fsr, height_limit, vendor, purchaser, agent1, agent2, firm1, firm2,
      exchange_date, settlement_date, campaign_close_date, year, notes, source_url)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(saleId, tracked.address, tracked.suburb, tracked.region, tracked.asset_class,
    tracked.process, 'Sold', price, tracked.price_guide, net_rent, yield_percent, wale,
    land_area, floor_area, tracked.zoning, tracked.fsr, tracked.height_limit,
    tracked.vendor, purchaser, tracked.agent1, tracked.agent2, tracked.firm1, tracked.firm2,
    exchange_date, pick(body.settlement_date, tracked.expected_settlement_date),
    tracked.campaign_close_date, year, body.notes || tracked.notes, tracked.source_url);
  db.prepare("UPDATE tracking SET status='Converted to Sale', updated_at=datetime('now') WHERE id=?")
    .run(req.params.id);
  backupDb().catch(() => {});
  res.json({ sale: db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId) });
});

// ── Validate (Discoveries) ────────────────────────────────────────────────────

app.get('/api/validate', requireAuth, (req, res) => {
  const { status } = req.query;
  const s = status || 'pending';
  res.json(db.prepare('SELECT * FROM discoveries WHERE status = ? ORDER BY scraped_at DESC').all(s));
});

app.post('/api/validate/:id/approve', requireAuth, (req, res) => {
  const disc = db.prepare('SELECT * FROM discoveries WHERE id = ?').get(req.params.id);
  if (!disc) return res.status(404).json({ error: 'Not found' });
  const body = req.body;
  const trackId = uuidv4();
  const year = new Date().getFullYear();
  db.prepare(`
    INSERT INTO tracking (id, address, suburb, region, asset_class, process, status,
      price_guide, agent1, firm1, year, notes, source_url, discovery_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(trackId, body.address || disc.address, body.suburb || disc.suburb,
    body.region || disc.region, body.asset_class || disc.asset_class,
    body.process || null, body.status || 'Active Campaign',
    body.price_guide || disc.price_guide, body.agent1 || disc.agent,
    body.firm1 || disc.firm, year, body.notes || disc.description,
    disc.source_url, disc.id);
  db.prepare("UPDATE discoveries SET status='approved', reviewed_at=datetime('now') WHERE id=?")
    .run(disc.id);
  res.json({ tracking: db.prepare('SELECT * FROM tracking WHERE id = ?').get(trackId) });
});

app.post('/api/validate/:id/dismiss', requireAuth, (req, res) => {
  db.prepare("UPDATE discoveries SET status='dismissed', reviewed_at=datetime('now') WHERE id=?")
    .run(req.params.id);
  res.json({ ok: true });
});

app.delete('/api/validate/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM discoveries WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});


// ── Excel Export ─────────────────────────────────────────────────────────────

// C&W brand palette (ARGB)
const XL = {
  NAVY:   'FF0D2137', NAVY2:  'FF1A3A5C', NAVY3:  'FF091929',
  ORANGE: 'FFE8732A', ORANGE2:'FFC45E1E',
  WHITE:  'FFFFFFFF', LGREY:  'FFF8F9FB', MGREY:  'FFE2E8F0',
  TEXT:   'FF0F172A', MUTED:  'FF64748B',
};

const XL_COLS = [
  { header: 'Address',          key: 'address',         width: 36, type: 'text'    },
  { header: 'Suburb',           key: 'suburb',          width: 15, type: 'text'    },
  { header: 'Region',           key: 'region',          width: 18, type: 'text'    },
  { header: 'Asset Class',      key: 'asset_class',     width: 20, type: 'text'    },
  { header: 'Process',          key: 'process',         width: 14, type: 'text'    },
  { header: 'Status',           key: 'status',          width: 10, type: 'text'    },
  { header: 'Sale Price',       key: 'price',           width: 15, type: 'currency'},
  { header: 'Price Guide',      key: 'price_guide',     width: 15, type: 'currency'},
  { header: 'Net Rent p.a.',    key: 'net_rent',        width: 14, type: 'currency'},
  { header: 'Yield %',          key: 'yield_percent',   width: 9,  type: 'pct'     },
  { header: 'WALE (yrs)',       key: 'wale',            width: 10, type: 'num1'    },
  { header: 'Land m²',         key: 'land_area',       width: 10, type: 'area'    },
  { header: 'Floor m²',        key: 'floor_area',      width: 10, type: 'area'    },
  { header: 'Zoning',           key: 'zoning',          width: 12, type: 'text'    },
  { header: 'FSR',              key: 'fsr',             width: 7,  type: 'text'    },
  { header: 'Agent 1',          key: 'agent1',          width: 24, type: 'text'    },
  { header: 'Firm 1',           key: 'firm1',           width: 24, type: 'text'    },
  { header: 'Agent 2',          key: 'agent2',          width: 24, type: 'text'    },
  { header: 'Firm 2',           key: 'firm2',           width: 24, type: 'text'    },
  { header: 'Vendor',           key: 'vendor',          width: 28, type: 'text'    },
  { header: 'Purchaser',        key: 'purchaser',       width: 28, type: 'text'    },
  { header: 'Exchange Date',    key: 'exchange_date',   width: 15, type: 'date'    },
  { header: 'Settlement Date',  key: 'settlement_date', width: 16, type: 'date'    },
  { header: 'Year',             key: 'year',            width: 7,  type: 'int'     },
  { header: 'Notes',            key: 'notes',           width: 52, type: 'text'    },
];

function buildSalesWorkbook(rows, subtitle) {
  const { Workbook } = require('exceljs');
  const wb = new Workbook();
  wb.creator = 'Cushman & Wakefield';
  wb.lastModifiedBy = 'C&W NSW Sales Intelligence';
  wb.created = new Date();

  const ws = wb.addWorksheet('NSW Investment Sales', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    headerFooter: {
      oddHeader: '&L&"Calibri,Bold"&14C&W NSW Sales Intelligence&R&D',
      oddFooter: '&L&"Calibri"Cushman & Wakefield · Confidential&RPage &P of &N',
    },
  });

  const nCols = XL_COLS.length;
  const lastCol = String.fromCharCode(64 + nCols); // e.g. 'Y'

  ws.columns = XL_COLS.map(c => ({ key: c.key, width: c.width }));

  // ── Row 1: Brand banner ──────────────────────────────────────────────────
  ws.addRow([`C&W  ·  NSW Sales Intelligence`]);
  ws.mergeCells(`A1:${lastCol}1`);
  const r1 = ws.getRow(1);
  r1.height = 42;
  const c1 = r1.getCell(1);
  c1.value = 'C&W  ·  NSW Sales Intelligence';
  c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.NAVY } };
  c1.font = { name: 'Calibri', color: { argb: XL.WHITE }, bold: true, size: 18 };
  c1.alignment = { vertical: 'middle', horizontal: 'left', indent: 2 };

  // ── Row 2: Report metadata ───────────────────────────────────────────────
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
  ws.addRow([`${subtitle}   ·   ${rows.length} ${rows.length === 1 ? 'property' : 'properties'}   ·   Generated ${dateStr}`]);
  ws.mergeCells(`A2:${lastCol}2`);
  const r2 = ws.getRow(2);
  r2.height = 22;
  const c2 = r2.getCell(1);
  c2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.NAVY2 } };
  c2.font = { name: 'Calibri', color: { argb: 'FFCBD5E1' }, size: 10, italic: true };
  c2.alignment = { vertical: 'middle', horizontal: 'left', indent: 2 };

  // ── Row 3: Orange accent bar ─────────────────────────────────────────────
  ws.addRow([]);
  ws.mergeCells(`A3:${lastCol}3`);
  const r3 = ws.getRow(3);
  r3.height = 5;
  r3.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.ORANGE } };

  // ── Row 4: Column headers ────────────────────────────────────────────────
  ws.addRow(XL_COLS.map(c => c.header));
  const r4 = ws.getRow(4);
  r4.height = 26;
  r4.eachCell((cell, colNum) => {
    const col = XL_COLS[colNum - 1];
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.NAVY } };
    cell.font = { name: 'Calibri', color: { argb: XL.WHITE }, bold: true, size: 10 };
    cell.alignment = {
      vertical: 'middle',
      horizontal: col && col.type !== 'text' && col.type !== 'date' ? 'right' : 'center',
      wrapText: false,
    };
    cell.border = {
      bottom: { style: 'medium', color: { argb: XL.ORANGE } },
      right:  { style: 'thin',   color: { argb: XL.NAVY2  } },
    };
  });

  // ── Data rows ────────────────────────────────────────────────────────────
  const numFmt = { currency: '"$"#,##0', pct: '0.00"%"', num1: '0.0', area: '#,##0', int: '0' };

  rows.forEach((r, idx) => {
    const values = XL_COLS.map(c => {
      const v = r[c.key];
      if (v === null || v === undefined || v === '') return null;
      if (c.type === 'currency' || c.type === 'pct' || c.type === 'num1' || c.type === 'area' || c.type === 'int') {
        const n = Number(v);
        return isNaN(n) ? null : n;
      }
      return v;
    });
    const row = ws.addRow(values);
    row.height = 18;
    const bg = idx % 2 === 0 ? XL.WHITE : XL.LGREY;

    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      const col = XL_COLS[colNum - 1];
      if (!col) return;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.font = { name: 'Calibri', color: { argb: XL.TEXT }, size: 10 };
      cell.border = {
        top:    { style: 'hair', color: { argb: XL.MGREY } },
        bottom: { style: 'hair', color: { argb: XL.MGREY } },
        left:   { style: 'hair', color: { argb: XL.MGREY } },
        right:  { style: 'hair', color: { argb: XL.MGREY } },
      };
      if (col.type === 'text' || col.type === 'date') {
        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: col.key === 'notes' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        if (numFmt[col.type]) cell.numFmt = numFmt[col.type];
      }
    });
  });

  // ── Summary row ──────────────────────────────────────────────────────────
  if (rows.length > 0) {
    const avg = (key) => {
      const vals = rows.map(r => Number(r[key])).filter(n => !isNaN(n) && n > 0);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };
    const sum = (key) => {
      const vals = rows.map(r => Number(r[key])).filter(n => !isNaN(n) && n > 0);
      return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
    };

    ws.addRow([]); // blank spacer before summary
    const summaryVals = XL_COLS.map(c => {
      if (c.key === 'address')       return `SUMMARY  (${rows.length} properties)`;
      if (c.key === 'price')         return sum('price');
      if (c.key === 'net_rent')      return avg('net_rent');
      if (c.key === 'yield_percent') return avg('yield_percent');
      if (c.key === 'wale')         return avg('wale');
      return null;
    });
    const sr = ws.addRow(summaryVals);
    sr.height = 22;
    sr.eachCell({ includeEmpty: true }, (cell, colNum) => {
      const col = XL_COLS[colNum - 1];
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.NAVY2 } };
      cell.font = { name: 'Calibri', color: { argb: XL.WHITE }, bold: true, size: 10 };
      cell.border = { top: { style: 'medium', color: { argb: XL.ORANGE } } };
      if (col && col.type !== 'text' && col.type !== 'date') {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        if (numFmt[col.type]) cell.numFmt = numFmt[col.type];
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left', indent: col && col.key === 'address' ? 1 : 0 };
      }
    });
  }

  // Freeze header rows, add auto-filter
  ws.views = [{ state: 'frozen', ySplit: 4, xSplit: 0 }];
  ws.autoFilter = { from: 'A4', to: `${lastCol}4` };

  return wb;
}

app.get('/api/sales/export', requireAuth, async (req, res) => {
  const { search, asset_class, process: proc, years, region, suburb } = req.query;
  let sql = 'SELECT * FROM sales WHERE 1=1';
  const params = [];
  if (search) {
    sql += ' AND (address LIKE ? OR suburb LIKE ? OR vendor LIKE ? OR purchaser LIKE ? OR agent1 LIKE ? OR notes LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s, s, s);
  }
  if (asset_class) { sql += ' AND asset_class = ?'; params.push(asset_class); }
  if (proc)        { sql += ' AND process = ?';     params.push(proc); }
  if (region)      { sql += ' AND region = ?';      params.push(region); }
  if (suburb)      { sql += ' AND LOWER(suburb) LIKE ?'; params.push(`%${suburb.toLowerCase()}%`); }
  if (years) {
    const yl = (Array.isArray(years) ? years : years.split(',')).map(Number).filter(Boolean);
    if (yl.length) { sql += ` AND year IN (${yl.map(() => '?').join(',')})`; params.push(...yl); }
  }
  sql += ' ORDER BY exchange_date DESC';
  const rows = db.prepare(sql).all(...params);

  // Build subtitle from active filters
  const parts = [];
  if (asset_class) parts.push(asset_class);
  if (region)      parts.push(region);
  if (proc)        parts.push(proc);
  if (years)       parts.push(years);
  const subtitle = parts.length ? `NSW Investment Sales  ·  ${parts.join('  ·  ')}` : 'NSW Investment Sales Database';

  const wb = buildSalesWorkbook(rows, subtitle);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="CW-NSW-Sales-${new Date().toISOString().slice(0,10)}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});

// Export a specific selection of sale IDs with same formatting
app.post('/api/sales/export-selected', requireAuth, async (req, res) => {
  const { ids = [] } = req.body;
  if (!ids.length) return res.status(400).json({ error: 'No IDs provided' });
  const placeholders = ids.map(() => '?').join(',');
  const rows = db.prepare(`SELECT * FROM sales WHERE id IN (${placeholders}) ORDER BY exchange_date DESC`).all(...ids);
  const wb = buildSalesWorkbook(rows, 'NSW Investment Sales — Selected Properties');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="CW-NSW-Sales-Selected-${new Date().toISOString().slice(0,10)}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});

// ── Filter Options ────────────────────────────────────────────────────────────

app.get('/api/options', requireAuth, (req, res) => {
  const table = req.query.table === 'tracking' ? 'tracking' : 'sales';
  const suburbs = db.prepare(`SELECT DISTINCT suburb FROM ${table} WHERE suburb IS NOT NULL ORDER BY suburb`).all().map(r => r.suburb);
  const years   = db.prepare(`SELECT DISTINCT year FROM ${table} WHERE year IS NOT NULL ORDER BY year DESC`).all().map(r => r.year);
  const regions = db.prepare(`SELECT DISTINCT region FROM ${table} WHERE region IS NOT NULL ORDER BY region`).all().map(r => r.region);
  res.json({ suburbs, years, regions });
});

// ── IM Extraction ─────────────────────────────────────────────────────────────

const IM_PROMPT = `You are a commercial real estate analyst. Extract data from this Information Memorandum and return ONLY a valid JSON object — no prose, no markdown fences.

Required JSON structure (use null for any field not found or unclear):
{
  "address": "full street address including street number, street name, suburb, NSW",
  "suburb": "suburb name only",
  "region": "one of exactly: CBD/City | Eastern Suburbs | Inner West | North Shore | Northern Beaches | Western Sydney | Hills District | Southern Sydney | South West Sydney",
  "asset_class": "one of exactly: Childcare | Commercial Office | Industrial | Retail | Strata Retail | Strata Office | Medical/Healthcare | Development Site | Fast Food/QSR | Service Station | Pub/Hotel | Apartment Blocks | Commercial",
  "process": "one of exactly: EOI | Auction | Private Treaty | Off-Market | Tender | Sale by Negotiation",
  "price_guide": null or integer (price guide in dollars, e.g. 4500000),
  "net_rent": null or integer (annual net rent in dollars),
  "estimated_yield": null or number (yield as a percentage number e.g. 5.5 for 5.5%),
  "wale": null or number (weighted average lease expiry in years),
  "land_area": null or integer (land area in square metres),
  "floor_area": null or integer (net lettable area or GFA in square metres),
  "zoning": "planning zone code and description e.g. B4 Mixed Use",
  "fsr": "floor space ratio as written e.g. 2.5:1",
  "height_limit": "height limit as written e.g. 24m",
  "vendor": "vendor or owner name if mentioned",
  "agent1": "selling agent first name and last name",
  "firm1": "selling agency or firm name",
  "agent2": null or "second agent name if listed",
  "firm2": null or "second firm name if listed",
  "campaign_close_date": null or "YYYY-MM-DD format if a campaign close date, EOI close date, or auction date is mentioned",
  "notes": "key investment highlights, tenancy details, lease expiry, development potential — max 300 characters"
}`;

app.post('/api/extract-im', requireAuth, async (req, res) => {
  if (!anthropic) {
    return res.status(503).json({
      error: 'AI extraction is not configured. Please set the ANTHROPIC_API_KEY environment variable in Railway.'
    });
  }

  const { filename, mimeType, data } = req.body;
  if (!data || !mimeType) return res.status(400).json({ error: 'No file data provided.' });

  const supportedImages = ['image/jpeg','image/jpg','image/png','image/gif','image/webp'];
  const isPDF   = mimeType === 'application/pdf';
  const isImage = supportedImages.includes(mimeType.toLowerCase());

  if (!isPDF && !isImage) {
    return res.status(400).json({
      error: `Unsupported file type: ${mimeType}. Please upload a PDF or image (PNG, JPG, WEBP).`
    });
  }

  try {
    const contentBlock = isPDF
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
      : { type: 'image',    source: { type: 'base64', media_type: mimeType, data } };

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: [contentBlock, { type: 'text', text: IM_PROMPT }]
      }]
    });

    const text = (message.content[0]?.text || '').trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Claude did not return valid JSON. Raw response: ' + text.slice(0, 200));

    const extracted = JSON.parse(jsonMatch[0]);
    res.json({ success: true, data: extracted, filename });
  } catch (err) {
    console.error('IM extraction error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Brains Trust ──────────────────────────────────────────────────────────────
app.post('/api/brains-trust', requireAuth, async (req, res) => {
  if (!anthropic) {
    return res.status(503).json({ error: 'AI not configured. Set ANTHROPIC_API_KEY in Railway.' });
  }
  const { query } = req.body || {};
  if (!query || query.trim().length < 5) return res.status(400).json({ error: 'Please describe what you are looking for.' });

  // Fetch compact versions of sales + tracking data
  const sales = db.prepare(`
    SELECT id, address, suburb, region, asset_class, process, price, net_rent, yield_percent,
           land_area, floor_area, notes, exchange_date, year, 'sold' as record_type
    FROM sales ORDER BY year DESC, price DESC LIMIT 200
  `).all();

  const tracking = db.prepare(`
    SELECT id, address, suburb, region, asset_class, process, status, price_guide, net_rent,
           estimated_yield, land_area, floor_area, notes, campaign_close_date, vendor, 'campaign' as record_type
    FROM tracking ORDER BY created_at DESC LIMIT 100
  `).all();

  // Compact text representation to minimise tokens
  const formatSale = s => `[SALE id:${s.id}] ${s.address}, ${s.suburb||''} | ${s.asset_class||'?'} | $${s.price ? (s.price/1e6).toFixed(2)+'M' : '?'} | yield:${s.yield_percent ? s.yield_percent.toFixed(2)+'%' : '?'} | ${s.process||''} | ${s.year||''} | land:${s.land_area||'?'}m² floor:${s.floor_area||'?'}m² | notes:${(s.notes||'').slice(0,120)}`;
  const formatTrack = t => `[CAMPAIGN id:${t.id} status:${t.status}] ${t.address}, ${t.suburb||''} | ${t.asset_class||'?'} | guide:$${t.price_guide ? (t.price_guide/1e6).toFixed(2)+'M' : '?'} | yield:${t.estimated_yield ? t.estimated_yield.toFixed(2)+'%' : '?'} | ${t.process||''} | vendor:${t.vendor||'?'} | notes:${(t.notes||'').slice(0,120)}`;

  const dbText = [
    ...tracking.map(formatTrack),
    ...sales.map(formatSale),
  ].join('\n');

  const prompt = `You are a senior commercial property advisor at Cushman & Wakefield NSW with deep market knowledge.

A colleague has described a property brief: "${query.trim()}"

Below is our internal sales database and campaign tracker. Use this data to make intelligent, specific suggestions.

DATABASE:
${dbText}

TASK: Analyse the brief and return the 5 most relevant matches or insights. Consider:
- Withdrawn campaigns (status "Withdrawn") — vendor may still be motivated to sell
- Properties in the same suburb or nearby with similar characteristics
- Asset classes that suit the stated use (owner-occupy, investment, development etc.)
- Price points and yields that align with the brief
- Opportunities that may not be obvious but warrant a call

Return a JSON array of exactly this shape (no markdown, raw JSON only):
[
  {
    "id": "the database id or null",
    "record_type": "sale" or "campaign",
    "address": "full address",
    "suburb": "suburb",
    "asset_class": "asset class",
    "price": numeric price or price_guide or null,
    "yield_percent": numeric yield or null,
    "status": "Sold / Withdrawn / Active Campaign / etc",
    "match_reason": "2-3 sentences explaining why this property fits the brief and what action to consider",
    "action": "short recommended action e.g. 'Call vendor direct', 'Monitor for re-listing', 'Strong match — arrange inspection'"
  }
]`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    });
    const text = (message.content[0]?.text || '').trim();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array returned');
    const suggestions = JSON.parse(jsonMatch[0]);
    res.json({ success: true, suggestions, query });
  } catch (err) {
    console.error('Brains Trust error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── IM File Storage ───────────────────────────────────────────────────────────

function sanitizeFilename(str) {
  return (str || '').replace(/[\/\\:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
}

// Save an IM file: POST /api/save-im  { data: base64, mimeType, suburb, address, agency }
app.post('/api/save-im', requireAuth, (req, res) => {
  const { data, mimeType, suburb, address, agency } = req.body || {};
  if (!data || !mimeType) return res.status(400).json({ error: 'No file data' });
  const ext = mimeType === 'application/pdf' ? 'pdf'
    : mimeType === 'image/png'  ? 'png'
    : mimeType === 'image/webp' ? 'webp'
    : 'jpg';
  const label = [
    sanitizeFilename(suburb),
    sanitizeFilename(address),
    agency ? '- ' + sanitizeFilename(agency) : ''
  ].filter(Boolean).join(', ').replace(/,\s*$/, '');
  const filename = (label || 'IM-' + Date.now()) + '.' + ext;
  const filepath = path.join(IM_DIR, filename);
  fs.writeFileSync(filepath, Buffer.from(data, 'base64'));
  res.json({ success: true, filename });
});

// List saved IMs: GET /api/ims
app.get('/api/ims', requireAuth, (req, res) => {
  const files = fs.readdirSync(IM_DIR)
    .filter(f => /\.(pdf|png|jpg|jpeg|webp)$/i.test(f))
    .map(f => {
      const stat = fs.statSync(path.join(IM_DIR, f));
      return { filename: f, size: stat.size, saved: stat.mtime.toISOString() };
    })
    .sort((a, b) => b.saved.localeCompare(a.saved));
  res.json(files);
});

// Download/view a saved IM: GET /api/ims/:filename
app.get('/api/ims/:filename', requireAuth, (req, res) => {
  const filepath = path.join(IM_DIR, path.basename(req.params.filename));
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Not found' });
  res.sendFile(filepath);
});

// Delete a saved IM: DELETE /api/ims/:filename
app.delete('/api/ims/:filename', requireAuth, (req, res) => {
  const filepath = path.join(IM_DIR, path.basename(req.params.filename));
  if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  res.json({ success: true });
});

// ── Portfolio Extraction ──────────────────────────────────────────────────────

const PORTFOLIO_PROMPT = `You are a commercial real estate analyst processing a Burgess Rawson / CBRE investment portfolio catalogue.

Extract ONLY the NSW (New South Wales) properties from this PDF and return ONLY a valid JSON array — no prose, no markdown fences, no commentary. Skip any properties in VIC, QLD, SA, WA, TAS, ACT or NT.

Each element represents one NSW property:
[
  {
    "tenant": "tenant or property name",
    "address": "full street address",
    "suburb": "suburb name",
    "state": "NSW",
    "region": "assign based on suburb — one of exactly: CBD/City | Eastern Suburbs | Inner West | North Shore | Northern Beaches | Western Sydney | Hills District | Southern Sydney | South West Sydney | Regional NSW",
    "asset_class": "one of: Supermarket | Convenience Retail | Service Station | Fast Food/QSR | Healthcare | Childcare | Fitness | Pub/Hotel | Office | Industrial | Retail | Commercial | Other",
    "net_rent": null or integer (annual net income in dollars, e.g. 250000),
    "price_guide": null or integer (price guide if stated),
    "yield_percent": null or number (yield as a percentage e.g. 5.5),
    "wale": null or number (weighted average lease expiry in years),
    "land_area": null or integer (land area in square metres),
    "floor_area": null or integer (building area in square metres),
    "auction_date": "YYYY-MM-DD" or null,
    "auction_location": "Sydney",
    "agent1": "agent name" or null,
    "firm1": "agency name" or null,
    "agent2": null or "second agent name",
    "firm2": null or "second firm name",
    "portfolio": "portfolio name e.g. CBRE Portfolio #185",
    "notes": "key lease details, tenant info, highlights — max 200 characters"
  }
]

NSW properties only — exclude all other states. Return ONLY the JSON array.`;

const AUCTION_RESULTS_PROMPT = `You are a commercial real estate analyst processing auction results (e.g. an AuctionWORKS results page, agency results sheet, or similar).

Extract every property result from this document and return ONLY a valid JSON object — no prose, no markdown fences, no commentary.

{
  "auction_date": "YYYY-MM-DD" or null (the auction session date, e.g. "23 Jun 2026" -> "2026-06-23"),
  "venue": "auction venue/session name" or null,
  "results": [
    {
      "suburb": "suburb name in normal case, e.g. 'South Hurstville' (source often shows it in ALL CAPS)",
      "address": "street address only, e.g. '190 Woniora Road' (do NOT repeat the suburb)",
      "outcome": "one of exactly: Sold Under Hammer | Sold Prior | Sold After | Passed In | Withdrawn",
      "price": null or integer (sale price in whole dollars, e.g. 'AU $2,670,000.00' -> 2670000; null if no price shown),
      "asset_class": "as shown, e.g. Commercial | Retail | Industrial" or null,
      "agency": "selling agency e.g. CBRE" or null,
      "auctioneer": "auctioneer name" or null
    }
  ]
}

Include every property, even ones without a price. Return ONLY the JSON object.`;

app.post('/api/extract-auction-results', requireAuth, async (req, res) => {
  if (!anthropic) return res.status(503).json({ error: 'AI not configured. Set ANTHROPIC_API_KEY in Railway.' });
  const { filename, mimeType, data } = req.body;
  if (!data || mimeType !== 'application/pdf') return res.status(400).json({ error: 'PDF required.' });
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } },
          { type: 'text', text: AUCTION_RESULTS_PROMPT }
        ]
      }]
    });
    const text = (message.content[0]?.text || '').trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Claude did not return JSON. Response: ' + text.slice(0, 200));
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed.results)) throw new Error('Expected a results array.');
    res.json({ success: true, count: parsed.results.length, ...parsed, filename });
  } catch (err) {
    console.error('Auction results extraction error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/extract-portfolio', requireAuth, async (req, res) => {
  if (!anthropic) return res.status(503).json({ error: 'AI not configured. Set ANTHROPIC_API_KEY in Railway.' });
  const { filename, mimeType, data } = req.body;
  if (!data || mimeType !== 'application/pdf') return res.status(400).json({ error: 'PDF required.' });
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } },
          { type: 'text', text: PORTFOLIO_PROMPT }
        ]
      }]
    });
    const text = (message.content[0]?.text || '').trim();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('Claude did not return a JSON array. Response: ' + text.slice(0, 200));
    const listings = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(listings)) throw new Error('Expected an array of properties.');
    // Strip city qualifiers in parentheses from suburb names e.g. "Darlington (Sydney)" → "Darlington"
    listings.forEach(l => {
      if (l.suburb) l.suburb = l.suburb.replace(/\s*\([^)]*\)\s*$/, '').trim();
    });
    res.json({ success: true, count: listings.length, listings, filename });
  } catch (err) {
    console.error('Portfolio extraction error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get all portfolio listings
app.get('/api/portfolio', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM portfolio_listings ORDER BY auction_date ASC, state ASC, suburb ASC').all();
  res.json(rows);
});

// Bulk insert extracted listings
app.post('/api/portfolio/bulk', requireAuth, (req, res) => {
  const { listings } = req.body || {};
  if (!Array.isArray(listings) || !listings.length) return res.status(400).json({ error: 'No listings provided.' });
  const ins = db.prepare(`
    INSERT INTO portfolio_listings (id, portfolio, tenant, address, suburb, state, region, asset_class,
      net_rent, price_guide, yield_percent, wale, land_area, floor_area, auction_date,
      auction_location, agent1, firm1, agent2, firm2, notes)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  const insertAll = db.transaction((rows) => {
    rows.forEach(l => {
      ins.run(uuidv4(), l.portfolio || null, l.tenant || null,
        l.address || null, l.suburb || null, l.state || 'NSW', l.region || null, l.asset_class || null,
        l.net_rent || null, l.price_guide || null, l.yield_percent || null,
        l.wale || null, l.land_area || null, l.floor_area || null,
        l.auction_date || null, l.auction_location || null,
        l.agent1 || null, l.firm1 || null, l.agent2 || null, l.firm2 || null,
        l.notes || null);
    });
  });
  insertAll(listings);
  res.json({ success: true, inserted: listings.length });
  // Backup immediately — don't lose freshly uploaded portfolio data on next redeploy
  backupDb().catch(e => console.error('[db-backup] Post-upload backup failed:', e.message));
});

// Update portfolio listing status / result / region
app.put('/api/portfolio/:id', requireAuth, (req, res) => {
  const { status, result_price, notes, region, tracking_id } = req.body || {};
  const fields = ['status=?', 'result_price=?', 'notes=?', "updated_at=datetime('now')"];
  const vals   = [status || 'Active', result_price ?? null, notes ?? null];
  if (region !== undefined)     { fields.push('region=?');     vals.push(region); }
  if (tracking_id !== undefined){ fields.push('tracking_id=?'); vals.push(tracking_id); }
  vals.push(req.params.id);
  db.prepare(`UPDATE portfolio_listings SET ${fields.join(',')} WHERE id=?`).run(...vals);
  res.json(db.prepare('SELECT * FROM portfolio_listings WHERE id = ?').get(req.params.id));
});

// Delete one portfolio listing
app.delete('/api/portfolio/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM portfolio_listings WHERE id = ?').run(req.params.id);
  db.prepare("INSERT OR REPLACE INTO deletions (id, table_name) VALUES (?, 'portfolio_listings')").run(req.params.id);
  backupDb().catch(() => {});
  res.json({ ok: true });
});

// Clear all portfolio listings
app.delete('/api/portfolio', requireAuth, (req, res) => {
  // Record every id so the boot-time snapshot merge can't resurrect them
  const ids = db.prepare('SELECT id FROM portfolio_listings').all();
  const rec = db.prepare("INSERT OR REPLACE INTO deletions (id, table_name) VALUES (?, 'portfolio_listings')");
  db.transaction(() => {
    for (const { id } of ids) rec.run(id);
    db.prepare('DELETE FROM portfolio_listings').run();
  })();
  backupDb().catch(() => {});
  res.json({ ok: true });
});

// ── Tracking duplicate detection ──────────────────────────────────────────────
// Same street number + street name, and suburbs that don't conflict = duplicate.
function trackNorm(s) {
  return String(s || '').toLowerCase().replace(/[.,]/g, ' ').replace(/\bnsw\b/g, '')
    .replace(/\b2\d{3}\b/g, '').replace(/\s+/g, ' ').trim();
}
function trackDupKey(r) {
  const a = trackNorm(r.address);
  const m = a.match(/(?:\d+[a-z]?\s*\/\s*)?(\d+[a-z]?)/);
  const num = m ? m[1] : a; // no street number -> fall back to full address
  const street = a.replace(/^(?:lot\s+\d+\s*,?\s*)?(?:\d+[a-z]?\s*\/\s*)?\d+[a-z]?(?:\s*-\s*\d+[a-z]?)?\s*/, '').split(' ')[0] || '';
  return num + '|' + street;
}
function suburbsCompatible(a, b) {
  const sa = trackNorm(a.suburb), sb = trackNorm(b.suburb);
  if (!sa || !sb) return true;
  return sa === sb || trackNorm(a.address).includes(sb) || trackNorm(b.address).includes(sa);
}
const TRACK_STATUS_PRIORITY = {
  'Converted to Sale': 5, 'Exchanged - Awaiting Settlement': 4,
  'Under Offer': 3, 'Active Campaign': 2, 'Withdrawn': 1,
};
function trackRowScore(r) {
  const filled = ['price_guide','net_rent','estimated_yield','wale','land_area','floor_area',
    'vendor','purchaser','agent1','firm1','campaign_close_date','exchange_date','notes','source_url']
    .filter(k => r[k] !== null && r[k] !== undefined && r[k] !== '').length;
  return (TRACK_STATUS_PRIORITY[r.status] || 0) * 100 + filled;
}
// Remove duplicate campaigns, keeping the most advanced/complete row per property.
// Deleted ids are recorded in deletions so snapshot merges can't resurrect them.
function dedupeTracking() {
  const rows = db.prepare('SELECT * FROM tracking').all();
  const groups = new Map();
  for (const r of rows) {
    const key = trackDupKey(r);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  const toDelete = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    // Sub-partition: only rows with non-conflicting suburbs are true duplicates
    const buckets = [];
    for (const r of group) {
      const b = buckets.find(bk => bk.every(x => suburbsCompatible(x, r)));
      if (b) b.push(r); else buckets.push([r]);
    }
    for (const bucket of buckets) {
      if (bucket.length < 2) continue;
      bucket.sort((a, b) => trackRowScore(b) - trackRowScore(a) ||
        String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
      toDelete.push(...bucket.slice(1).map(r => r.id));
    }
  }
  if (toDelete.length) {
    const del = db.prepare('DELETE FROM tracking WHERE id = ?');
    const rec = db.prepare("INSERT OR REPLACE INTO deletions (id, table_name) VALUES (?, 'tracking')");
    db.transaction(() => { for (const id of toDelete) { del.run(id); rec.run(id); } })();
    console.log(`[dedupe] Removed ${toDelete.length} duplicate campaign(s)`);
  }
  return toDelete.length;
}

app.post('/api/tracking/dedupe', requireAuth, (req, res) => {
  const removed = dedupeTracking();
  if (removed) backupDb().catch(() => {});
  res.json({ ok: true, removed });
});

// Convert portfolio listing → tracking campaign
app.post('/api/portfolio/:id/track', requireAuth, (req, res) => {
  const listing = db.prepare('SELECT * FROM portfolio_listings WHERE id = ?').get(req.params.id);
  if (!listing) return res.status(404).json({ error: 'Not found' });
  const body = req.body;

  // Already tracked? Link to the existing campaign instead of creating a duplicate
  const probe = { address: body.address || listing.address, suburb: body.suburb || listing.suburb };
  const existing = db.prepare("SELECT * FROM tracking WHERE status != 'Converted to Sale'").all()
    .find(t => trackDupKey(t) === trackDupKey(probe) && suburbsCompatible(t, probe));
  if (existing) {
    db.prepare(`UPDATE portfolio_listings SET status='Tracking', tracking_id=?, updated_at=datetime('now') WHERE id=?`)
      .run(existing.id, req.params.id);
    return res.json({ tracking: existing, duplicate: true });
  }

  const trackId = uuidv4();
  db.prepare(`
    INSERT INTO tracking (id, address, suburb, region, asset_class, process, status,
      price_guide, net_rent, estimated_yield, wale, land_area, floor_area,
      agent1, firm1, agent2, firm2, campaign_close_date, year, notes)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(trackId,
    body.address || listing.address, body.suburb || listing.suburb,
    body.region || listing.region || null, body.asset_class || listing.asset_class,
    'Auction', body.status || 'Active Campaign',
    body.price_guide || listing.price_guide || null,
    body.net_rent || listing.net_rent || null,
    body.estimated_yield || listing.yield_percent || null,
    body.wale || listing.wale || null,
    body.land_area || listing.land_area || null,
    body.floor_area || listing.floor_area || null,
    body.agent1 || listing.agent1 || null, body.firm1 || listing.firm1 || null,
    body.agent2 || listing.agent2 || null, body.firm2 || listing.firm2 || null,
    listing.auction_date || null,
    listing.auction_date ? new Date(listing.auction_date).getFullYear() : new Date().getFullYear(),
    body.notes || [listing.tenant, listing.portfolio, listing.notes].filter(Boolean).join(' | ') || null
  );
  db.prepare(`UPDATE portfolio_listings SET status='Tracking', tracking_id=?, updated_at=datetime('now') WHERE id=?`)
    .run(trackId, req.params.id);
  backupDb().catch(() => {});
  res.json({ tracking: db.prepare('SELECT * FROM tracking WHERE id = ?').get(trackId) });
});

// ── New Listings Search (Serper.dev + Claude) ────────────────────────────────

const NSW_SEARCH_QUERIES = [
  'NSW commercial investment property for sale EOI auction 2026 site:commercialrealestate.com.au',
  'NSW commercial investment property for sale 2026 site:realcommercial.com.au',
  'NSW childcare "service station" industrial retail investment for sale EOI tender 2026',
  '"New South Wales" commercial investment for sale Colliers OR "Knight Frank" OR "Ray White Commercial" EOI 2026',
];

async function runSerperSearch(query) {
  const r = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: { 'X-API-KEY': process.env.SERPER_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: query, gl: 'au', hl: 'en', num: 10 }),
  });
  if (!r.ok) throw new Error(`Serper ${r.status}`);
  return r.json();
}

app.post('/api/listings/search', requireAuth, async (req, res) => {
  if (!anthropic) return res.status(503).json({ error: 'ANTHROPIC_API_KEY not set in Railway.' });
  if (!process.env.SERPER_API_KEY) return res.status(503).json({
    error: 'SERPER_API_KEY not set. Go to serper.dev, create a free account (2,500 searches/month free), copy your API key, then add SERPER_API_KEY to your Railway variables.'
  });

  try {
    const organic = [];
    for (const q of NSW_SEARCH_QUERIES) {
      try {
        const data = await runSerperSearch(q);
        if (data.organic) organic.push(...data.organic);
      } catch (e) { console.error('[search] query failed:', e.message); }
    }

    const seen = new Set();
    const unique = organic.filter(r => r.link && !seen.has(r.link) && seen.add(r.link));
    if (!unique.length) return res.json({ searched: 0, found: 0, added: 0, listings: [] });

    const resultsText = unique.slice(0, 40).map((r, i) =>
      `[${i + 1}] URL: ${r.link}\nTitle: ${r.title}\nSnippet: ${r.snippet || ''}`
    ).join('\n\n');

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: `You are a commercial real estate analyst. Extract NSW commercial investment property listings from these Google search results.

INCLUDE: Genuine NSW commercial properties currently FOR SALE (investment grade: offices, industrial, childcare, service stations, medical, retail investments, pubs, development sites etc.)
EXCLUDE: Residential properties, non-NSW properties, leasing/for-lease, already-sold listings, news/articles, property management, research reports, "wanted to buy" ads

Return ONLY a JSON array (no markdown fences, no commentary):
[{
  "address": "full street address or best available",
  "suburb": "suburb name",
  "region": "one of: CBD/City | Eastern Suburbs | Inner West | North Shore | Northern Beaches | Western Sydney | Hills District | Southern Sydney | South West Sydney | Regional NSW",
  "asset_class": "one of: Childcare | Commercial Office | Industrial | Retail | Strata Retail | Strata Office | Medical/Healthcare | Development Site | Fast Food/QSR | Service Station | Pub/Hotel | Commercial",
  "price_guide": null or integer dollars,
  "net_rent": null or integer annual dollars,
  "wale": null or number years,
  "agent": "agent name or null",
  "firm": "agency name or null",
  "source_url": "exact URL from the result",
  "description": "1-2 sentences: what it is, key metrics, sale process"
}]

If no genuine for-sale listings found, return [].

Search results:
${resultsText}`
      }]
    });

    const text = (msg.content[0]?.text || '').trim();
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return res.json({ searched: unique.length, found: 0, added: 0, listings: [] });

    let listings = [];
    try { listings = JSON.parse(match[0]); } catch (e) { /* ignore */ }
    if (!Array.isArray(listings)) listings = [];

    const existingUrls = new Set([
      ...db.prepare('SELECT source_url FROM discoveries WHERE source_url IS NOT NULL').all().map(r => r.source_url),
      ...db.prepare('SELECT source_url FROM tracking WHERE source_url IS NOT NULL').all().map(r => r.source_url),
      ...db.prepare('SELECT source_url FROM sales WHERE source_url IS NOT NULL').all().map(r => r.source_url),
    ]);

    const ins = db.prepare(`INSERT INTO discoveries
      (id, address, suburb, region, asset_class, price_guide, description, agent, firm, source_url, status)
      VALUES (?,?,?,?,?,?,?,?,?,?,'pending')`);

    let added = 0;
    const newListings = [];
    db.transaction(() => {
      for (const l of listings) {
        if (!l.source_url || existingUrls.has(l.source_url)) continue;
        if (!l.address && !l.suburb) continue;
        const id = uuidv4();
        ins.run(id, l.address || null, l.suburb || null, l.region || null, l.asset_class || null,
          l.price_guide ? String(l.price_guide) : null,
          l.description || null, l.agent || null, l.firm || null, l.source_url);
        newListings.push({ id, ...l, status: 'pending' });
        added++;
      }
    })();

    console.log(`[listings-search] ${unique.length} results → ${listings.length} listings → ${added} new`);
    res.json({ searched: unique.length, found: listings.length, added, listings: newListings });
  } catch (e) {
    console.error('[listings-search]', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/listings/pending-count', requireAuth, (req, res) => {
  res.json({ count: db.prepare("SELECT COUNT(*) as c FROM discoveries WHERE status='pending'").get().c });
});

app.get('/api/listings/pending', requireAuth, (req, res) => {
  res.json(db.prepare("SELECT * FROM discoveries WHERE status='pending' ORDER BY scraped_at DESC").all());
});

app.post('/api/listings/:id/track', requireAuth, (req, res) => {
  const disc = db.prepare('SELECT * FROM discoveries WHERE id=?').get(req.params.id);
  if (!disc) return res.status(404).json({ error: 'Not found' });
  const trackId = uuidv4();
  db.prepare(`INSERT INTO tracking (id, address, suburb, region, asset_class, status, price_guide, agent1, firm1, year, notes, source_url, discovery_id)
    VALUES (?,?,?,?,?,'Active Campaign',?,?,?,?,?,?,?)`)
    .run(trackId, disc.address, disc.suburb, disc.region, disc.asset_class,
      disc.price_guide ? parseFloat(disc.price_guide) : null,
      disc.agent, disc.firm, new Date().getFullYear(),
      disc.description, disc.source_url, disc.id);
  db.prepare("UPDATE discoveries SET status='approved', reviewed_at=datetime('now') WHERE id=?").run(disc.id);
  res.json({ ok: true, tracking: db.prepare('SELECT * FROM tracking WHERE id=?').get(trackId) });
});

app.post('/api/listings/:id/dismiss', requireAuth, (req, res) => {
  db.prepare("UPDATE discoveries SET status='dismissed', reviewed_at=datetime('now') WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

// SPA fallback — MUST pass /api requests through to routes registered below
// (previously it swallowed them: no response, no next() → requests hung forever)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


let s3Client = null;
function getS3() {
  if (s3Client) return s3Client;
  const endpoint  = process.env.BUCKET_ENDPOINT_URL;
  const accessKey = process.env.BUCKET_ACCESS_KEY_ID;
  const secretKey = process.env.BUCKET_SECRET_ACCESS_KEY;
  const region    = process.env.BUCKET_REGION || 'auto';
  if (!endpoint || !accessKey || !secretKey) return null;
  const { S3Client } = require('@aws-sdk/client-s3');
  s3Client = new S3Client({
    endpoint, region,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    forcePathStyle: true,
    maxAttempts: 3,
    // Fail fast instead of hanging forever if the bucket endpoint is slow/unreachable.
    // The SDK builds a NodeHttpHandler from these options.
    requestHandler: { connectionTimeout: 5000, requestTimeout: 15000 },
    // Newer AWS SDKs attach CRC32 checksums by default; several S3-compatible
    // providers reject or stall on them. Only send checksums when the API requires it.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
  return s3Client;
}

const backupState = { lastTime: null, lastStatus: 'never', lastError: null, inProgress: false };

async function backupDb() {
  const s3 = getS3();
  const bucket = process.env.BUCKET_NAME;
  if (!s3 || !bucket) {
    backupState.lastStatus = 'no-bucket';
    return false;
  }
  if (backupState.inProgress) return false;
  const dbPath = path.join(DATA_DIR, 'sales.db');
  if (!fs.existsSync(dbPath)) { console.log('[db-backup] sales.db not found, skipping'); return false; }
  backupState.inProgress = true;
  try {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    const counts = {
      sales:     db.prepare('SELECT COUNT(*) as c FROM sales').get().c,
      tracking:  db.prepare('SELECT COUNT(*) as c FROM tracking').get().c,
      portfolio: db.prepare('SELECT COUNT(*) as c FROM portfolio_listings').get().c,
    };

    // Primary backup: raw SQLite file.
    // The DB runs in WAL mode — recent writes live in sales.db-wal until a checkpoint,
    // so flush the WAL into the main file first or the upload misses the latest sales.
    try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch (e) { console.error('[db-backup] WAL checkpoint failed:', e.message); }
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: 'sales.db', Body: fs.readFileSync(dbPath) }));

    // Secondary backup: JSON snapshot — survives DB corruption and serves as seed fallback
    const snapshot = {
      backed_up_at: new Date().toISOString(),
      sales:             db.prepare('SELECT * FROM sales ORDER BY id').all(),
      tracking:          db.prepare('SELECT * FROM tracking ORDER BY id').all(),
      portfolio_listings: db.prepare('SELECT * FROM portfolio_listings ORDER BY id').all(),
      deletions:         db.prepare('SELECT * FROM deletions').all(),
    };
    await s3.send(new PutObjectCommand({
      Bucket: bucket, Key: 'seed_backup.json',
      Body: JSON.stringify(snapshot), ContentType: 'application/json',
    }));

    backupState.lastTime   = new Date().toISOString();
    backupState.lastStatus = 'ok';
    backupState.lastError  = null;
    console.log(`[db-backup] Backed up — sales:${counts.sales} tracking:${counts.tracking} portfolio:${counts.portfolio}`);
    return true;
  } catch (e) {
    backupState.lastStatus = 'error';
    backupState.lastError  = e.message;
    console.error('[db-backup] Error:', e.message);
    return false;
  } finally {
    backupState.inProgress = false;
  }
}

// Back up every 5 minutes
setInterval(backupDb, 5 * 60 * 1000);

// Back up on Railway deploy shutdown signal
process.on('SIGTERM', async () => {
  console.log('[shutdown] Backing up DB before exit...');
  await backupDb();
  process.exit(0);
});

// True when DATA_DIR sits on a different filesystem than the app code —
// i.e. a mounted Railway volume that survives redeploys.
function hasPersistentDisk() {
  try { return fs.statSync(DATA_DIR).dev !== fs.statSync(__dirname).dev; }
  catch { return false; }
}

app.get('/api/admin/backup-status', requireAuth, (req, res) => {
  const bucketOk = !!(process.env.BUCKET_ENDPOINT_URL && process.env.BUCKET_NAME &&
    process.env.BUCKET_ACCESS_KEY_ID && process.env.BUCKET_SECRET_ACCESS_KEY);
  const counts = {
    sales:     db.prepare('SELECT COUNT(*) as c FROM sales').get().c,
    tracking:  db.prepare('SELECT COUNT(*) as c FROM tracking').get().c,
    portfolio: db.prepare('SELECT COUNT(*) as c FROM portfolio_listings').get().c,
  };
  res.json({ ...backupState, bucketOk, persistentDisk: hasPersistentDisk(), counts });
});

app.post('/api/admin/backup', requireAuth, async (req, res) => {
  if (!process.env.BUCKET_ENDPOINT_URL || !process.env.BUCKET_NAME) {
    return res.status(503).json({ error: 'Bucket not configured. Add BUCKET_* variables in Railway.' });
  }
  const ok = await backupDb();
  res.json({ ok, ...backupState });
});

// Bucket connectivity test — write a tiny probe object and read it back
app.get('/api/admin/bucket-test', requireAuth, async (req, res) => {
  const endpoint  = process.env.BUCKET_ENDPOINT_URL;
  const bucket    = process.env.BUCKET_NAME;
  const accessKey = process.env.BUCKET_ACCESS_KEY_ID;
  const secretKey = process.env.BUCKET_SECRET_ACCESS_KEY;
  const region    = process.env.BUCKET_REGION || 'auto';

  const missing = ['BUCKET_ENDPOINT_URL','BUCKET_NAME','BUCKET_ACCESS_KEY_ID','BUCKET_SECRET_ACCESS_KEY']
    .filter(k => !process.env[k]);
  if (missing.length) return res.json({ ok: false, error: `Missing env vars: ${missing.join(', ')}` });

  const diag = { endpoint, bucket, region, keyPrefix: accessKey ? accessKey.slice(0,8) + '…' : 'MISSING' };

  try {
    const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
    // Always create a fresh client here so we test current env vars, not a cached client
    const testS3 = new S3Client({
      endpoint, region,
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
      forcePathStyle: true,
      maxAttempts: 1,
      requestHandler: { connectionTimeout: 5000, requestTimeout: 15000 },
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
    const probe = `probe-${Date.now()}`;
    await testS3.send(new PutObjectCommand({ Bucket: bucket, Key: '.probe', Body: probe, ContentType: 'text/plain' }));
    const r = await testS3.send(new GetObjectCommand({ Bucket: bucket, Key: '.probe' }));
    const chunks = []; for await (const c of r.Body) chunks.push(c);
    const back = Buffer.concat(chunks).toString();
    if (back !== probe) return res.json({ ok: false, error: 'Read-back mismatch', diag });
    console.log('[bucket-test] ✓ Connected to', endpoint, '/', bucket);
    res.json({ ok: true, message: 'Bucket read/write verified ✓', endpoint, bucket });
  } catch (e) {
    const code = e.Code || e.code || e.name || '';
    let hint = '';
    if (code === 'InvalidAccessKeyId' || code.includes('AccessDenied')) hint = 'Wrong BUCKET_ACCESS_KEY_ID';
    else if (code === 'SignatureDoesNotMatch') hint = 'Wrong BUCKET_SECRET_ACCESS_KEY';
    else if (code === 'NoSuchBucket') hint = 'Wrong BUCKET_NAME';
    else if (e.message && e.message.includes('ECONNREFUSED')) hint = 'Cannot reach BUCKET_ENDPOINT_URL';
    else if (e.message && e.message.includes('getaddrinfo')) hint = 'Cannot resolve BUCKET_ENDPOINT_URL hostname';
    console.error('[bucket-test] ✗', code, e.message);
    res.json({ ok: false, error: hint || e.message || code || 'Unknown error', code, diag });
  }
});


function applySeed() {
  // Prefer a JSON snapshot downloaded from the bucket (more recent than the committed seed)
  const bucketSeedPath = path.join(DATA_DIR, 'latest_seed.json');
  const committedSeedPath = path.join(__dirname, 'seeds', 'sales_2026.json');
  const seedPath = fs.existsSync(bucketSeedPath) ? bucketSeedPath : committedSeedPath;
  if (!fs.existsSync(seedPath)) { console.log('[seed] No seed file found — skipping'); return; }
  console.log('[seed] Applying seed from', seedPath);
  let data;
  try {
    data = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  } catch (e) {
    console.error('[seed] Failed to parse seed file:', e.message);
    return;
  }
  const { sales = [], tracking = [], portfolio_listings = [], deletions = [] } = data;

  // Restore deletions table first so subsequent seed steps respect them
  try {
    const ins = db.prepare("INSERT OR REPLACE INTO deletions (id, table_name, deleted_at) VALUES (@id, @table_name, @deleted_at)");
    db.transaction(() => { for (const r of deletions) ins.run(r); })();
    if (deletions.length) console.log(`[seed] ${deletions.length} deletions restored`);
  } catch (e) { console.error('[seed] Deletions error:', e.message); }

  // Each table seeded independently so one failure never blocks the others
  try {
    const deletedSaleIds = new Set(
      db.prepare("SELECT id FROM deletions WHERE table_name='sales'").all().map(r => r.id)
    );
    const ins = db.prepare(`INSERT OR IGNORE INTO sales (
      id,address,suburb,region,asset_class,process,status,price,price_guide,net_rent,
      yield_percent,wale,land_area,floor_area,zoning,fsr,height_limit,vendor,purchaser,
      agent1,agent2,firm1,firm2,exchange_date,settlement_date,campaign_close_date,year,notes
    ) VALUES (
      @id,@address,@suburb,@region,@asset_class,@process,@status,@price,@price_guide,@net_rent,
      @yield_percent,@wale,@land_area,@floor_area,@zoning,@fsr,@height_limit,@vendor,@purchaser,
      @agent1,@agent2,@firm1,@firm2,@exchange_date,@settlement_date,@campaign_close_date,@year,@notes
    )`);
    let n = 0;
    db.transaction(() => { for (const r of sales) { if (!deletedSaleIds.has(r.id)) n += ins.run(r).changes; } })();
    console.log(`[seed] ${n}/${sales.length} sales inserted (${deletedSaleIds.size} deletions respected)`);
  } catch (e) { console.error('[seed] Sales error:', e.message); }

  try {
    const deletedIds = new Set(
      db.prepare("SELECT id FROM deletions WHERE table_name='tracking'").all().map(r => r.id)
    );
    const trackCols = ['id','address','suburb','region','asset_class','process','status',
      'price_guide','net_rent','estimated_yield','wale','land_area','floor_area','zoning',
      'fsr','height_limit','vendor','purchaser','agent1','agent2','firm1','firm2',
      'campaign_close_date','exchange_date','expected_settlement_date','year','notes','source_url'];
    const ins = db.prepare(`INSERT OR IGNORE INTO tracking (${trackCols.join(',')})
      VALUES (${trackCols.map(c => '@' + c).join(',')})`);
    // Normalize each row so missing keys (older seeds/snapshots) bind as null
    const norm = r => Object.fromEntries(trackCols.map(c => [c, r[c] ?? null]));
    let n = 0;
    db.transaction(() => {
      for (const r of tracking) {
        if (!deletedIds.has(r.id)) n += ins.run(norm(r)).changes;
      }
    })();
    console.log(`[seed] ${n}/${tracking.length} campaigns inserted (${deletedIds.size} deletions respected)`);
  } catch (e) { console.error('[seed] Tracking error:', e.message); }

  try {
    const deletedPortfolioIds = new Set(
      db.prepare("SELECT id FROM deletions WHERE table_name='portfolio_listings'").all().map(r => r.id)
    );
    const pCols = ['id','tenant','address','suburb','state','region','asset_class','net_rent',
      'price_guide','yield_percent','wale','land_area','floor_area','auction_date','auction_location',
      'agent1','firm1','agent2','firm2','portfolio','notes','status','result_price','tracking_id'];
    const ins = db.prepare(`INSERT OR IGNORE INTO portfolio_listings (${pCols.join(',')})
      VALUES (${pCols.map(c => '@' + c).join(',')})`);
    const norm = r => Object.fromEntries(pCols.map(c => [c, r[c] ?? null]));
    let n = 0;
    db.transaction(() => {
      for (const r of portfolio_listings) {
        if (!deletedPortfolioIds.has(r.id)) n += ins.run(norm(r)).changes;
      }
    })();
    if (portfolio_listings.length) console.log(`[seed] ${n}/${portfolio_listings.length} portfolio listings inserted (${deletedPortfolioIds.size} deletions respected)`);
  } catch (e) { console.error('[seed] Portfolio error:', e.message); }
}
applySeed();

// ── One-time asset class fixes (idempotent — safe to run on every startup) ────
(function fixAssetClasses() {
  try {
    // All sales with no asset_class are Development Sites (Western Sydney growth corridors)
    const r1 = db.prepare("UPDATE sales SET asset_class='Development Site' WHERE asset_class IS NULL OR asset_class=''").run();
    // Specific reclassifications backed by tenancy/notes evidence
    const fixes = [
      { id: '416f8985-42c9-4424-a418-478183b243bf', cls: 'Retail' },       // 97-99 Queen St Woollahra – Post Office + Bonhams
      { id: 'b72d8c17-3f2d-4c82-85c2-158d71a08010', cls: 'Retail' },       // 354 Oxford St Paddington – Pet Barn 100% occupier
      { id: '9f07836e-8dbf-4dca-a4f2-a2298af852a5', cls: 'Shop Top' },     // 181A Edgecliff Rd – 3 retail + 4 residential flats
      { id: '6c130c5c-e365-4e28-aaf0-f1d8504281e7', cls: 'Shop Top' },     // 286-294a Campbell Pde North Bondi – 4 retail + 6 resi
      { id: '86d8821f-d20c-46f8-9a66-891036dcd7c7', cls: 'Industrial' },   // 48 Oxford St Woollahra – warehouse/tyre tenant
    ];
    const upd = db.prepare("UPDATE sales SET asset_class=? WHERE id=?");
    let n = 0;
    db.transaction(() => { for (const {id, cls} of fixes) n += upd.run(cls, id).changes; })();
    // 47-51 Riley Street Woolloomooloo – DA for commercial development
    const r2 = db.prepare("UPDATE sales SET asset_class='Development Site' WHERE address LIKE '47-51 Riley Street%' AND asset_class='Commercial'").run();
    // Recalculate yield_percent where price + net_rent exist but yield is missing
    const r3 = db.prepare("UPDATE sales SET yield_percent=ROUND(net_rent/price*100,2) WHERE price>0 AND net_rent>0 AND yield_percent IS NULL").run();
    if (r1.changes || n || r2.changes || r3.changes) {
      console.log(`[fixup] Asset classes fixed: ${r1.changes} null, ${n} specific, ${r2.changes} Riley St. Yields: ${r3.changes}`);
    }
  } catch (e) { console.error('[fixup] Asset class fix error:', e.message); }

  // ── Comparables deep-dive (Jul 2026): evidence-based reclassifications ──────
  try {
    const reclass = [
      ['874f42d9-e985-4f02-85e3-a69ea705fa8c', 'Shop Top'],        // 56 Campbell Pde — 4 apts + cafe
      ['d3d595ff-55e3-4426-965b-f78426eb50a0', 'Shop Top'],        // 16-18 McKeon St — units + GF shop
      ['71746875-63dd-4f15-8698-7c48dc5af840', 'Apartment Blocks'],// 346 Arden St — existing 4x2-bed block
      ['b5439dab-7aff-4a00-be03-a9f4a6c3091b', 'Shop Top'],        // 217-221 Coogee Bay Rd — 2 shops + 4 units
      ['e2356c2c-fa85-4747-a70a-0155d3d934e4', 'Retail'],          // 115 Avoca St — yielding retail freehold
      ['98b0df2e-8fa5-4685-b9a6-175a9fe5c007', 'Retail'],          // 41 Hall St — retail + commercial freehold
      ['fe569af7-5aa2-4ad6-8b55-190f483a5af8', 'Shop Top'],        // 27 Hall St — 6 apts + 2 retail
      ['c2ceccf9-95c9-429a-93ab-e750373d0e04', 'Retail'],          // 27-29 Knox St — ANZ branch
      ['03837b23-8ec5-4126-ba31-abbf8f4cae5f', 'Shop Top'],        // 32 Campbell Pde
      ['1a6413d0-3307-4df8-a49d-1afd8ed46003', 'Shop Top'],        // 433 Crown St
      ['1a92bd80-f9f2-4b03-8235-d1a5d8fb7cc3', 'Shop Top'],        // 317 Clovelly Rd
      ['2bb209a1-1b1b-4291-9626-0d8802e59697', 'Shop Top'],        // 33 St Pauls St
      ['31875715-eccb-4595-a850-089fad207a87', 'Shop Top'],        // 58 William St
      ['87861383-1b7d-4831-ad36-16e9fae690fa', 'Shop Top'],        // 358 Botany Rd
      ['94458987-e4b3-478b-9adc-7639016fe76b', 'Shop Top'],        // 1 Belmore Rd
      ['ae62e2a7-446c-4f88-a868-d0946bea8405', 'Shop Top'],        // 130-132 Coogee Bay Rd
      ['b96a4e66-1fc3-4bfb-9af5-df398f59dc7c', 'Shop Top'],        // 164-166 Edgecliff Rd
      ['cf5d32a8-a68f-4744-a987-952880e8dde1', 'Shop Top'],        // 5 Canberra St
      ['43da1c7f-cf49-4f9d-926b-596bd4705951', 'Shop Top'],        // 307 Clovelly Rd — "shop top" in notes
      ['2a467025-73d8-45e1-a0a8-0a37ce47e260', 'Retail'],          // 246 Coogee Bay Rd — commercial both levels
    ];
    const upd = db.prepare('UPDATE sales SET asset_class=? WHERE id=? AND asset_class != ?');
    let n = 0;
    db.transaction(() => { for (const [id, cls] of reclass) n += upd.run(cls, id, cls).changes; })();

    // 250 Terrigal Drive is in Erina (Central Coast), not Sydney
    db.prepare("UPDATE sales SET suburb='Erina', region='Regional NSW' WHERE id='12b7c51a-5ca0-4164-b661-2e1cba221b3a' AND suburb='Sydney'").run();

    // Duplicate comparables (same property + price recorded twice) — remove and
    // record in deletions so snapshot merges can't bring them back
    const dupIds = [
      '0c465a11-27c6-4769-a13b-9f94a0047f30','0eecbe06-d9f7-48c9-a18c-e070d78869d1',
      '19026f19-61d1-4e33-8c50-98942278830f','2be7d934-452d-4774-ab85-51022541500d',
      '4451eee6-1aa3-4c09-8c28-2fb2f13fa696','4edc24df-b9f5-4015-a133-010b04b5dc3a',
      '5bac5226-13f0-4c1d-b4e0-1a1d2bd63f02','662c3a68-e4ae-4d28-b156-8ffc08660b06',
      '663f2894-9be0-4c3c-bc7e-8747bcc66e90','9dee972e-cf1f-4cba-9fcd-aa08503e4b09',
      'bc5da840-ae05-4472-ab32-b806feaef83d','be999281-e9d0-4f25-b1fc-3c8d7c05c0b8',
      'c2bec978-43fa-4cd6-b16a-65f0958639ce','ce2e29dd-a5e5-4a8a-973c-4ec6efc4056f',
      'd8055d3c-62a8-44f4-a8a6-260c259c20e1','d8313233-c9fa-45f3-aa64-7db0dc77180c',
      'dcce9cad-b801-41cf-ae3a-a3c01fea30e1','eb7df54a-bcc3-4de6-be20-5de094cb87db',
      'ff205920-7ac7-4e0e-9de0-4dee5311e6cc',
    ];
    const del = db.prepare('DELETE FROM sales WHERE id = ?');
    const rec = db.prepare("INSERT OR REPLACE INTO deletions (id, table_name) VALUES (?, 'sales')");
    let removed = 0;
    db.transaction(() => { for (const id of dupIds) { removed += del.run(id).changes; rec.run(id); } })();

    if (n || removed) console.log(`[fixup] Comparables deep-dive: ${n} reclassified, ${removed} duplicates removed`);
  } catch (e) { console.error('[fixup] Comparables fix error:', e.message); }
})();

// Remove any duplicate campaigns on every boot (idempotent) — the snapshot
// merge can introduce same-property rows with different ids from older backups
try { dedupeTracking(); } catch (e) { console.error('[dedupe] Startup dedupe error:', e.message); }


// ── Force reseed endpoint — call this to immediately restore all data ──────────
app.post('/api/admin/reseed', requireAuth, (req, res) => {
  try {
    const seedPath = path.join(__dirname, 'seeds', 'sales_2026.json');
    if (!fs.existsSync(seedPath)) return res.status(404).json({ error: 'Seed file not found' });
    const { sales = [], tracking = [], portfolio_listings = [] } = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
    const insSale = db.prepare(`INSERT OR IGNORE INTO sales (
      id,address,suburb,region,asset_class,process,status,price,price_guide,net_rent,
      yield_percent,wale,land_area,floor_area,zoning,fsr,height_limit,vendor,purchaser,
      agent1,agent2,firm1,firm2,exchange_date,settlement_date,campaign_close_date,year,notes
    ) VALUES (
      @id,@address,@suburb,@region,@asset_class,@process,@status,@price,@price_guide,@net_rent,
      @yield_percent,@wale,@land_area,@floor_area,@zoning,@fsr,@height_limit,@vendor,@purchaser,
      @agent1,@agent2,@firm1,@firm2,@exchange_date,@settlement_date,@campaign_close_date,@year,@notes
    )`);
    const insTrack = db.prepare(`INSERT OR IGNORE INTO tracking (
      id,address,suburb,region,asset_class,process,status,price_guide,net_rent,
      estimated_yield,vendor,agent1,agent2,firm1,firm2,campaign_close_date,
      expected_settlement_date,year,notes
    ) VALUES (
      @id,@address,@suburb,@region,@asset_class,@process,@status,@price_guide,@net_rent,
      @estimated_yield,@vendor,@agent1,@agent2,@firm1,@firm2,@campaign_close_date,
      @expected_settlement_date,@year,@notes
    )`);
    let sc = 0, tc = 0;
    const tx = db.transaction(() => {
      for (const r of sales)    sc += insSale.run(r).changes;
      for (const r of tracking) tc += insTrack.run(r).changes;
    });
    tx();
    console.log(`[reseed] Inserted ${sc} sales, ${tc} campaigns`);
    res.json({ success: true, sales_inserted: sc, tracking_inserted: tc, total_sales: db.prepare('SELECT COUNT(*) as c FROM sales').get().c });
  } catch (e) {
    console.error('[reseed] Error:', e.message);
    res.status(500).json({ error: e.message });
  }
});


app.get('/api/admin/export', requireAuth, (req, res) => {
  try {
    const sales             = db.prepare('SELECT * FROM sales ORDER BY id').all();
    const tracking          = db.prepare('SELECT * FROM tracking ORDER BY id').all();
    const portfolio_listings = db.prepare('SELECT * FROM portfolio_listings ORDER BY id').all();
    const payload = { exported_at: new Date().toISOString(), sales, tracking, portfolio_listings };
    res.setHeader('Content-Disposition', 'attachment; filename="sales_backup.json"');
    res.json(payload);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`NSW Investment Sales DB running on port ${PORT}`);
  console.log(`Default password: ${APP_PASSWORD === 'CW@Investment2025' ? '(default - set APP_PASSWORD env var)' : '(custom)'}`);
  console.log(hasPersistentDisk()
    ? `[storage] ✓ ${DATA_DIR} is on a persistent volume — data survives redeploys`
    : `[storage] ⚠ ${DATA_DIR} is EPHEMERAL — data survives redeploys only via bucket backup. Mount a Railway volume at ${DATA_DIR} to fix permanently.`);
  // Backup immediately on startup so the bucket is always current after a deploy
  setTimeout(() => backupDb().catch(e => console.error('[db-backup] Startup backup failed:', e.message)), 3000);
});
