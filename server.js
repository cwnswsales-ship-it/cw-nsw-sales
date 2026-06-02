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
  res.json(db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id));
});

app.delete('/api/sales/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM sales WHERE id = ?').run(req.params.id);
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
  const id = uuidv4();
  const year = body.year || new Date().getFullYear();
  db.prepare(`
    INSERT INTO tracking (id, address, suburb, region, asset_class, process, status,
      price_guide, net_rent, estimated_yield, wale, land_area, floor_area, zoning, fsr, height_limit,
      vendor, agent1, agent2, firm1, firm2,
      campaign_close_date, expected_settlement_date, year, notes, source_url, discovery_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(id, body.address, body.suburb, body.region, body.asset_class, body.process,
    body.status || 'Active Campaign', body.price_guide, body.net_rent, body.estimated_yield,
    body.wale, body.land_area, body.floor_area, body.zoning, body.fsr, body.height_limit,
    body.vendor, body.agent1, body.agent2, body.firm1, body.firm2,
    body.campaign_close_date, body.expected_settlement_date, year,
    body.notes, body.source_url, body.discovery_id || null);
  res.json(db.prepare('SELECT * FROM tracking WHERE id = ?').get(id));
});

app.put('/api/tracking/:id', requireAuth, (req, res) => {
  const body = req.body;
  const year = body.year || undefined;
  db.prepare(`
    UPDATE tracking SET address=?, suburb=?, region=?, asset_class=?, process=?, status=?,
      price_guide=?, net_rent=?, estimated_yield=?, wale=?, land_area=?, floor_area=?,
      zoning=?, fsr=?, height_limit=?,
      vendor=?, agent1=?, agent2=?, firm1=?, firm2=?,
      campaign_close_date=?, expected_settlement_date=?, year=?, notes=?, source_url=?,
      updated_at=datetime('now')
    WHERE id=?
  `).run(body.address, body.suburb, body.region, body.asset_class, body.process,
    body.status || 'Active Campaign', body.price_guide, body.net_rent, body.estimated_yield,
    body.wale, body.land_area, body.floor_area, body.zoning, body.fsr, body.height_limit,
    body.vendor, body.agent1, body.agent2, body.firm1, body.firm2,
    body.campaign_close_date, body.expected_settlement_date, year,
    body.notes, body.source_url, req.params.id);
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
  res.json({ ok: true });
});

// Convert tracking → sale (settlement complete)
app.post('/api/tracking/:id/sell', requireAuth, (req, res) => {
  const tracked = db.prepare('SELECT * FROM tracking WHERE id = ?').get(req.params.id);
  if (!tracked) return res.status(404).json({ error: 'Not found' });
  const body = req.body;
  const saleId = uuidv4();
  const year = body.year || (body.exchange_date ? new Date(body.exchange_date).getFullYear() : new Date().getFullYear());
  db.prepare(`
    INSERT INTO sales (id, address, suburb, region, asset_class, process, status,
      price, price_guide, net_rent, yield_percent, wale, land_area, floor_area,
      vendor, purchaser, agent1, agent2, firm1, firm2,
      exchange_date, settlement_date, campaign_close_date, year, notes, source_url)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(saleId, tracked.address, tracked.suburb, tracked.region, tracked.asset_class,
    tracked.process, 'Sold', body.price, tracked.price_guide, body.net_rent || tracked.net_rent,
    body.yield_percent, body.wale, body.land_area, body.floor_area,
    tracked.vendor, body.purchaser, tracked.agent1, tracked.agent2, tracked.firm1, tracked.firm2,
    body.exchange_date, body.settlement_date, tracked.campaign_close_date,
    year, body.notes || tracked.notes, tracked.source_url);
  db.prepare("UPDATE tracking SET status='Converted to Sale', updated_at=datetime('now') WHERE id=?")
    .run(req.params.id);
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

  const NAVY = 'FF0D2137', ORANGE = 'FFE8732A', WHITE = 'FFFFFFFF', LGREY = 'FFF0F2F5';
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Cushman & Wakefield';
  const ws = wb.addWorksheet('NSW Investment Sales');

  ws.columns = [
    { key: 'address',         width: 32 }, { key: 'suburb',          width: 15 },
    { key: 'region',          width: 18 }, { key: 'asset_class',     width: 18 },
    { key: 'process',         width: 16 }, { key: 'status',          width: 12 },
    { key: 'price',           width: 16 }, { key: 'price_guide',     width: 16 },
    { key: 'net_rent',        width: 14 }, { key: 'yield_percent',   width: 10 },
    { key: 'wale',            width: 10 }, { key: 'land_area',       width: 10 },
    { key: 'floor_area',      width: 10 }, { key: 'zoning',          width: 14 },
    { key: 'fsr',             width: 8  }, { key: 'agent1',          width: 22 },
    { key: 'firm1',           width: 22 }, { key: 'vendor',          width: 28 },
    { key: 'purchaser',       width: 28 }, { key: 'exchange_date',   width: 14 },
    { key: 'settlement_date', width: 14 }, { key: 'year',            width: 8  },
    { key: 'notes',           width: 55 },
  ];

  // Title row
  ws.addRow(['NSW Investment Sales — Cushman & Wakefield']);
  ws.mergeCells('A1:W1');
  const tc = ws.getCell('A1');
  tc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ORANGE } };
  tc.font = { color: { argb: WHITE }, bold: true, size: 14 };
  tc.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(1).height = 36;

  // Header row
  ws.addRow(['Address','Suburb','Region','Asset Class','Process','Status',
    'Price','Price Guide','Net Rent (pa)','Yield %','WALE (yrs)','Land m²','Floor m²',
    'Zoning','FSR','Agent','Firm','Vendor','Purchaser','Exchange Date','Settlement Date','Year','Notes']);
  const hr = ws.getRow(2);
  hr.height = 24;
  hr.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    cell.font = { color: { argb: WHITE }, bold: true, size: 10 };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = { bottom: { style: 'medium', color: { argb: ORANGE } } };
  });

  // Data rows
  rows.forEach((r, idx) => {
    const row = ws.addRow([
      r.address, r.suburb, r.region, r.asset_class, r.process, r.status,
      r.price || null, r.price_guide || null, r.net_rent || null,
      r.yield_percent || null, r.wale || null, r.land_area || null, r.floor_area || null,
      r.zoning, r.fsr, r.agent1, r.firm1, r.vendor, r.purchaser,
      r.exchange_date, r.settlement_date, r.year, r.notes,
    ]);
    row.height = 18;
    const bg = idx % 2 === 0 ? WHITE : LGREY;
    row.eachCell({ includeEmpty: true }, cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.alignment = { vertical: 'middle' };
    });
    ['G','H','I'].forEach(col => { const c = row.getCell(col); if (c.value) c.numFmt = '"$"#,##0'; });
    const yc = row.getCell('J'); if (yc.value) yc.numFmt = '0.00"%"';
    ['L','M'].forEach(col => { const c = row.getCell(col); if (c.value) c.numFmt = '#,##0'; });
  });

  ws.views = [{ state: 'frozen', ySplit: 2 }];
  ws.autoFilter = { from: 'A2', to: 'W2' };

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="nsw-investment-sales-${new Date().toISOString().slice(0,10)}.xlsx"`);
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
  res.json({ ok: true });
});

// Clear all portfolio listings
app.delete('/api/portfolio', requireAuth, (req, res) => {
  db.prepare('DELETE FROM portfolio_listings').run();
  res.json({ ok: true });
});

// Convert portfolio listing → tracking campaign
app.post('/api/portfolio/:id/track', requireAuth, (req, res) => {
  const listing = db.prepare('SELECT * FROM portfolio_listings WHERE id = ?').get(req.params.id);
  if (!listing) return res.status(404).json({ error: 'Not found' });
  const body = req.body;
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

// SPA fallback
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
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
  s3Client = new S3Client({ endpoint, region, credentials: { accessKeyId: accessKey, secretAccessKey: secretKey }, forcePathStyle: true });
  return s3Client;
}

async function backupDb() {
  const s3 = getS3();
  const bucket = process.env.BUCKET_NAME;
  if (!s3 || !bucket) return;
  const dbPath = path.join(DATA_DIR, 'sales.db');
  if (!fs.existsSync(dbPath)) { console.log('[db-backup] sales.db not found, skipping'); return; }
  try {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: 'sales.db', Body: fs.readFileSync(dbPath) }));
    console.log('[db-backup] Database backed up to bucket');
  } catch (e) {
    console.error('[db-backup] Error:', e.message);
  }
}

// Back up every 15 minutes
setInterval(backupDb, 15 * 60 * 1000);

// Back up on Railway deploy shutdown signal
process.on('SIGTERM', async () => {
  console.log('[shutdown] Backing up DB before exit...');
  await backupDb();
  process.exit(0);
});


function applySeed() {
  const seedPath = path.join(__dirname, 'seeds', 'sales_2026.json');
  if (!fs.existsSync(seedPath)) { console.log('[seed] seeds/sales_2026.json not found — skipping'); return; }
  console.log('[seed] Applying seed from', seedPath);
  let data;
  try {
    data = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  } catch (e) {
    console.error('[seed] Failed to parse seed file:', e.message);
    return;
  }
  const { sales = [], tracking = [], portfolio_listings = [] } = data;

  // Each table seeded independently so one failure never blocks the others
  try {
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
    db.transaction(() => { for (const r of sales) n += ins.run(r).changes; })();
    console.log(`[seed] ${n}/${sales.length} sales inserted`);
  } catch (e) { console.error('[seed] Sales error:', e.message); }

  try {
    const ins = db.prepare(`INSERT OR IGNORE INTO tracking (
      id,address,suburb,region,asset_class,process,status,price_guide,net_rent,
      estimated_yield,vendor,agent1,agent2,firm1,firm2,campaign_close_date,
      expected_settlement_date,year,notes
    ) VALUES (
      @id,@address,@suburb,@region,@asset_class,@process,@status,@price_guide,@net_rent,
      @estimated_yield,@vendor,@agent1,@agent2,@firm1,@firm2,@campaign_close_date,
      @expected_settlement_date,@year,@notes
    )`);
    let n = 0;
    db.transaction(() => { for (const r of tracking) n += ins.run(r).changes; })();
    console.log(`[seed] ${n}/${tracking.length} campaigns inserted`);
  } catch (e) { console.error('[seed] Tracking error:', e.message); }

  try {
    const ins = db.prepare(`INSERT OR IGNORE INTO portfolio_listings (
      id,tenant,address,suburb,state,asset_class,net_rent,price_guide,yield_percent,
      wale,land_area,floor_area,auction_date,auction_location,agent1,firm1,agent2,firm2,
      portfolio,notes,status
    ) VALUES (
      @id,@tenant,@address,@suburb,@state,@asset_class,@net_rent,@price_guide,@yield_percent,
      @wale,@land_area,@floor_area,@auction_date,@auction_location,@agent1,@firm1,@agent2,@firm2,
      @portfolio,@notes,@status
    )`);
    let n = 0;
    db.transaction(() => { for (const r of portfolio_listings) n += ins.run(r).changes; })();
    if (portfolio_listings.length) console.log(`[seed] ${n}/${portfolio_listings.length} portfolio listings inserted`);
  } catch (e) { console.error('[seed] Portfolio error:', e.message); }
}
applySeed();

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
});
