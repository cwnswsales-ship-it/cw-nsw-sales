'use strict';

const ExcelJS     = require('exceljs');
const express     = require('express');
const cors        = require('cors');
const compression = require('compression');
const path        = require('path');
const crypto      = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db          = require('./db');

let anthropic = null;
try {
  const Anthropic = require('@anthropic-ai/sdk');
  if (process.env.ANTHROPIC_API_KEY) {
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
} catch(e) { /* SDK not installed yet */ }

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

// SPA fallback
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});


app.listen(PORT, () => {
  console.log(`NSW Investment Sales DB running on port ${PORT}`);
  console.log(`Default password: ${APP_PASSWORD === 'CW@Investment2025' ? '(default - set APP_PASSWORD env var)' : '(custom)'}`);
});
