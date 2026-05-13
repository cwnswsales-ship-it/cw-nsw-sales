'use strict';

const express     = require('express');
const cors        = require('cors');
const compression = require('compression');
const path        = require('path');
const cron        = require('node-cron');
const XLSX        = require('xlsx');
const { db, gId } = require('./db');
const { runScraper } = require('./scraper');

const app = express();

app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── Field mapping helpers ──────────────────────────────────────────────────

// camelCase body → snake_case DB columns for sales
function saleBodyToRow(body) {
  return {
    source:          body.source,
    address:         body.address,
    suburb:          body.suburb,
    region:          body.region,
    classification:  body.classification,
    status:          body.status,
    price:           numOrNull(body.price),
    price_guide:     numOrNull(body.priceGuide ?? body.price_guide),
    net_rent:        numOrNull(body.netRent ?? body.net_rent),
    outgoings:       numOrNull(body.outgoings),
    yld:             numOrNull(body.yld),
    date_listed:     body.dateListed ?? body.date_listed ?? null,
    sale_date:       body.saleDate ?? body.sale_date ?? null,
    settlement_date: body.settlementDate ?? body.settlement_date ?? null,
    process:         body.process,
    campaign_close:  body.campaignClose ?? body.campaign_close ?? null,
    rc_status:       body.rcStatus ?? body.rc_status ?? null,
    land_area:       numOrNull(body.landArea ?? body.land_area),
    land_rate:       numOrNull(body.landRate ?? body.land_rate),
    floor_area:      numOrNull(body.floorArea ?? body.floor_area),
    cap_val:         numOrNull(body.capVal ?? body.cap_val),
    units:           numOrNull(body.units),
    unit_rate:       numOrNull(body.unitRate ?? body.unit_rate),
    wale:            numOrNull(body.wale),
    parking:         numOrNull(body.parking),
    configuration:   body.configuration ?? null,
    land_area_ha:    numOrNull(body.landAreaHa ?? body.land_area_ha),
    land_rate_ha:    numOrNull(body.landRateHa ?? body.land_rate_ha),
    land_area_acre:  numOrNull(body.landAreaAcre ?? body.land_area_acre),
    land_rate_acre:  numOrNull(body.landRateAcre ?? body.land_rate_acre),
    no_lots:         numOrNull(body.noLots ?? body.no_lots),
    lot_rate:        numOrNull(body.lotRate ?? body.lot_rate),
    perm_gfa:        numOrNull(body.permGfa ?? body.perm_gfa),
    gfa_sqm:         numOrNull(body.gfaSqm ?? body.gfa_sqm),
    zoning:          body.zoning ?? null,
    zoning2:         body.zoning2 ?? null,
    fsr:             numOrNull(body.fsr),
    height:          numOrNull(body.height),
    approval:        numOrNull(body.approval),
    dev_stage:       body.devStage ?? body.dev_stage ?? null,
    constraints:     body.constraints ?? null,
    agent1:          body.agent1 ?? null,
    agent2:          body.agent2 ?? null,
    vendor:          body.vendor ?? null,
    purchaser:       body.purchaser ?? null,
    comments:        body.comments ?? null,
    analysis:        body.analysis ?? null,
    operator:        body.operator ?? null,
    places:          numOrNull(body.places),
    price_per_place: numOrNull(body.pricePerPlace ?? body.price_per_place),
    rent_per_place:  numOrNull(body.rentPerPlace ?? body.rent_per_place),
  };
}

function rowToSale(row) {
  return {
    id:             row.id,
    source:         row.source,
    address:        row.address,
    suburb:         row.suburb,
    region:         row.region,
    classification: row.classification,
    status:         row.status,
    price:          row.price,
    priceGuide:     row.price_guide,
    netRent:        row.net_rent,
    outgoings:      row.outgoings,
    yld:            row.yld,
    dateListed:     row.date_listed,
    saleDate:       row.sale_date,
    settlementDate: row.settlement_date,
    process:        row.process,
    campaignClose:  row.campaign_close,
    rcStatus:       row.rc_status,
    landArea:       row.land_area,
    landRate:       row.land_rate,
    floorArea:      row.floor_area,
    capVal:         row.cap_val,
    units:          row.units,
    unitRate:       row.unit_rate,
    wale:           row.wale,
    parking:        row.parking,
    configuration:  row.configuration,
    landAreaHa:     row.land_area_ha,
    landRateHa:     row.land_rate_ha,
    landAreaAcre:   row.land_area_acre,
    landRateAcre:   row.land_rate_acre,
    noLots:         row.no_lots,
    lotRate:        row.lot_rate,
    permGfa:        row.perm_gfa,
    gfaSqm:         row.gfa_sqm,
    zoning:         row.zoning,
    zoning2:        row.zoning2,
    fsr:            row.fsr,
    height:         row.height,
    approval:       row.approval,
    devStage:       row.dev_stage,
    constraints:    row.constraints,
    agent1:         row.agent1,
    agent2:         row.agent2,
    vendor:         row.vendor,
    purchaser:      row.purchaser,
    comments:       row.comments,
    analysis:       row.analysis,
    operator:       row.operator,
    places:         row.places,
    pricePerPlace:  row.price_per_place,
    rentPerPlace:   row.rent_per_place,
    createdAt:      row.created_at,
    updatedAt:      row.updated_at,
  };
}

function numOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function autoCalc(row) {
  // Land rate
  if (row.price && row.land_area && !row.land_rate) {
    row.land_rate = row.price / row.land_area;
  }
  // Yield
  if (row.price && row.net_rent && !row.yld) {
    row.yld = row.net_rent / row.price;
  }
  // Childcare per-place metrics
  if (row.classification === 'Childcare Centre' && row.places) {
    if (row.price && !row.price_per_place) {
      row.price_per_place = row.price / row.places;
    }
    if (row.net_rent && !row.rent_per_place) {
      row.rent_per_place = row.net_rent / row.places;
    }
  }
  return row;
}

// ═══════════════════════════════════════════════════════════════════════════
// SALES ROUTES
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/sales', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM sales ORDER BY created_at DESC').all();
    res.json(rows.map(rowToSale));
  } catch (err) {
    console.error('[GET /api/sales]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sales', (req, res) => {
  try {
    const id = req.body.id || gId();
    let row = saleBodyToRow(req.body);
    row = autoCalc(row);

    const cols = Object.keys(row).filter(k => row[k] !== undefined);
    const vals = cols.map(k => row[k]);

    db.prepare(
      `INSERT INTO sales (id, ${cols.join(',')}, created_at, updated_at)
       VALUES (?, ${cols.map(() => '?').join(',')}, datetime('now'), datetime('now'))`
    ).run(id, ...vals);

    const created = db.prepare('SELECT * FROM sales WHERE id = ?').get(id);
    res.status(201).json(rowToSale(created));
  } catch (err) {
    console.error('[POST /api/sales]', err.message);
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/sales/:id', (req, res) => {
  try {
    const { id } = req.params;
    let row = saleBodyToRow(req.body);
    row = autoCalc(row);

    const cols = Object.keys(row).filter(k => row[k] !== undefined);
    const vals = cols.map(k => row[k]);

    db.prepare(
      `UPDATE sales SET ${cols.map(c => `${c} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`
    ).run(...vals, id);

    const updated = db.prepare('SELECT * FROM sales WHERE id = ?').get(id);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(rowToSale(updated));
  } catch (err) {
    console.error('[PUT /api/sales/:id]', err.message);
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/sales/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM sales WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/sales/:id]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CAMPAIGNS ROUTES
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/campaigns', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM campaigns ORDER BY close_date ASC').all();
    res.json(rows);
  } catch (err) {
    console.error('[GET /api/campaigns]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/campaigns', (req, res) => {
  try {
    const id = req.body.id || gId();
    const b = req.body;
    db.prepare(`
      INSERT INTO campaigns
        (id, address, suburb, region, source, classification, process, date_listed,
         close_date, price_guide, net_income, agent1, agent2, vendor, zoning,
         land_area, notes, result_notes, status, sale_price, purchaser, sold_date,
         settlement_date, source_url, scrape_source, last_checked, created_at, updated_at)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
         datetime('now'), datetime('now'))
    `).run(
      id, b.address, b.suburb ?? null, b.region ?? null,
      b.source ?? 'Metro', b.classification ?? null, b.process ?? null,
      b.dateListed ?? b.date_listed ?? null, b.closeDate ?? b.close_date ?? null,
      numOrNull(b.priceGuide ?? b.price_guide),
      numOrNull(b.netIncome ?? b.net_income),
      b.agent1 ?? null, b.agent2 ?? null, b.vendor ?? null,
      b.zoning ?? null, numOrNull(b.landArea ?? b.land_area),
      b.notes ?? null, b.resultNotes ?? b.result_notes ?? null,
      b.status ?? 'active', numOrNull(b.salePrice ?? b.sale_price),
      b.purchaser ?? null, b.soldDate ?? b.sold_date ?? null,
      b.settlementDate ?? b.settlement_date ?? null,
      b.sourceUrl ?? b.source_url ?? null,
      b.scrapeSource ?? b.scrape_source ?? null,
      null
    );
    const created = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id);
    res.status(201).json(created);
  } catch (err) {
    console.error('[POST /api/campaigns]', err.message);
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/campaigns/:id', (req, res) => {
  try {
    const { id } = req.params;
    const b = req.body;
    const existing = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    db.prepare(`
      UPDATE campaigns SET
        address = ?, suburb = ?, region = ?, source = ?, classification = ?,
        process = ?, date_listed = ?, close_date = ?, price_guide = ?,
        net_income = ?, agent1 = ?, agent2 = ?, vendor = ?, zoning = ?,
        land_area = ?, notes = ?, result_notes = ?, status = ?,
        sale_price = ?, purchaser = ?, sold_date = ?, settlement_date = ?,
        source_url = ?, last_checked = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      b.address ?? existing.address,
      b.suburb ?? existing.suburb,
      b.region ?? existing.region,
      b.source ?? existing.source,
      b.classification ?? existing.classification,
      b.process ?? existing.process,
      b.dateListed ?? b.date_listed ?? existing.date_listed,
      b.closeDate ?? b.close_date ?? existing.close_date,
      numOrNull(b.priceGuide ?? b.price_guide) ?? existing.price_guide,
      numOrNull(b.netIncome ?? b.net_income) ?? existing.net_income,
      b.agent1 ?? existing.agent1,
      b.agent2 ?? existing.agent2,
      b.vendor ?? existing.vendor,
      b.zoning ?? existing.zoning,
      numOrNull(b.landArea ?? b.land_area) ?? existing.land_area,
      b.notes ?? existing.notes,
      b.resultNotes ?? b.result_notes ?? existing.result_notes,
      b.status ?? existing.status,
      numOrNull(b.salePrice ?? b.sale_price) ?? existing.sale_price,
      b.purchaser ?? existing.purchaser,
      b.soldDate ?? b.sold_date ?? existing.sold_date,
      b.settlementDate ?? b.settlement_date ?? existing.settlement_date,
      b.sourceUrl ?? b.source_url ?? existing.source_url,
      existing.last_checked,
      id
    );

    res.json(db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id));
  } catch (err) {
    console.error('[PUT /api/campaigns/:id]', err.message);
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/campaigns/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/campaigns/:id]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DISCOVERIES ROUTES
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/discoveries', (req, res) => {
  try {
    const status = req.query.status || 'pending';
    const rows = db.prepare(
      `SELECT * FROM discoveries WHERE status = ? ORDER BY is_premium DESC, created_at DESC`
    ).all(status);
    res.json(rows);
  } catch (err) {
    console.error('[GET /api/discoveries]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/discoveries/:id/accept', (req, res) => {
  try {
    const disc = db.prepare('SELECT * FROM discoveries WHERE id = ?').get(req.params.id);
    if (!disc) return res.status(404).json({ error: 'Discovery not found' });

    // Insert into campaigns
    const campaignId = gId();
    db.prepare(`
      INSERT INTO campaigns
        (id, address, suburb, region, source, classification, process, close_date,
         price_guide, net_income, agent1, zoning, status, source_url, scrape_source,
         last_checked, created_at, updated_at)
      VALUES
        (?, ?, ?, ?, 'Metro', ?, ?, ?, ?, ?, ?, null, 'active', ?, ?, datetime('now'), datetime('now'), datetime('now'))
    `).run(
      campaignId,
      disc.address, disc.suburb, disc.region,
      disc.classification, disc.process, disc.close_date,
      disc.price_guide, disc.net_income, disc.agent,
      disc.source_url, disc.scrape_source,
      new Date().toISOString()
    );

    // Update discovery status
    db.prepare(`UPDATE discoveries SET status = 'accepted' WHERE id = ?`).run(req.params.id);

    // Create alert
    const alertId = gId();
    db.prepare(`
      INSERT INTO alerts (id, type, title, body, link_id, link_type, read, created_at)
      VALUES (?, 'tracked', ?, ?, ?, 'campaign', 0, datetime('now'))
    `).run(
      alertId,
      `Now tracking: ${disc.address}`,
      `Discovery accepted and added to active campaigns. Source: ${disc.scrape_source || 'unknown'}.`,
      campaignId
    );

    const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
    res.status(201).json(campaign);
  } catch (err) {
    console.error('[POST /api/discoveries/:id/accept]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/discoveries/:id/dismiss', (req, res) => {
  try {
    const info = db.prepare(`UPDATE discoveries SET status = 'dismissed' WHERE id = ?`).run(req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[POST /api/discoveries/:id/dismiss]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ALERTS ROUTES
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/alerts', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM alerts ORDER BY created_at DESC LIMIT 50').all();
    res.json(rows);
  } catch (err) {
    console.error('[GET /api/alerts]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/alerts/:id/read', (req, res) => {
  try {
    db.prepare(`UPDATE alerts SET read = 1 WHERE id = ?`).run(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('[POST /api/alerts/:id/read]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/alerts/read-all', (req, res) => {
  try {
    db.prepare(`UPDATE alerts SET read = 1 WHERE read = 0`).run();
    res.json({ ok: true });
  } catch (err) {
    console.error('[POST /api/alerts/read-all]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SCRAPER ROUTES
// ═══════════════════════════════════════════════════════════════════════════

app.post('/api/scrape', async (req, res) => {
  try {
    const result = await runScraper(db);
    res.json(result);
  } catch (err) {
    console.error('[POST /api/scrape]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/scrape/log', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM scrape_log ORDER BY id DESC LIMIT 10').all();
    res.json(rows);
  } catch (err) {
    console.error('[GET /api/scrape/log]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// STATS ROUTE
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/stats', (req, res) => {
  try {
    const totalSales = db.prepare('SELECT COUNT(*) AS c FROM sales').get().c;
    const activeCampaigns = db.prepare(`SELECT COUNT(*) AS c FROM campaigns WHERE status = 'active'`).get().c;
    const pendingDiscoveries = db.prepare(`SELECT COUNT(*) AS c FROM discoveries WHERE status = 'pending'`).get().c;
    const premiumDiscoveries = db.prepare(`SELECT COUNT(*) AS c FROM discoveries WHERE status = 'pending' AND is_premium = 1`).get().c;
    const unreadAlerts = db.prepare(`SELECT COUNT(*) AS c FROM alerts WHERE read = 0`).get().c;

    const recentSales = db.prepare(`
      SELECT id, address, suburb, price, classification, sale_date
      FROM sales ORDER BY created_at DESC LIMIT 5
    `).all();

    const topAgents = db.prepare(`
      SELECT agent1 AS agent, COUNT(*) AS deals
      FROM sales
      WHERE agent1 IS NOT NULL AND agent1 != ''
      GROUP BY agent1
      ORDER BY deals DESC
      LIMIT 5
    `).all();

    res.json({
      totalSales,
      activeCampaigns,
      pendingDiscoveries,
      premiumDiscoveries,
      unreadAlerts,
      recentSales,
      topAgents,
    });
  } catch (err) {
    console.error('[GET /api/stats]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT ROUTE
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/export', (req, res) => {
  try {
    const { source, classification, status } = req.query;

    let query = 'SELECT * FROM sales WHERE 1=1';
    const params = [];
    if (source) { query += ' AND source = ?'; params.push(source); }
    if (classification) { query += ' AND classification = ?'; params.push(classification); }
    if (status) { query += ' AND status = ?'; params.push(status); }
    query += ' ORDER BY created_at DESC';

    const rows = db.prepare(query).all(...params);

    // Build header row
    const headers = [
      'Address', 'Suburb', 'Region', 'Classification', 'Status',
      'Sale Price', 'Price Guide', 'Net Rent', 'Yield %', 'WALE',
      'Land Area m²', 'Land $/m²', 'Floor Area m²', 'Zoning',
      'Agent 1', 'Agent 2', 'Vendor', 'Purchaser',
      'Sale Date', 'Settlement Date', 'Process',
      'Operator', 'Licensed Places', '$/Place', 'Rent/Place', 'Comments',
    ];

    // Cell format styles
    const FMT_CURRENCY  = '"$"#,##0';
    const FMT_YIELD     = '0.00%';
    const FMT_DATE      = 'dd-mmm-yyyy';
    const FMT_AREA      = '#,##0';
    const FMT_LAND_RATE = '"$"#,##0';

    function dateSerial(dateStr) {
      if (!dateStr) return null;
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        // Excel date serial: days since 1900-01-01 (with Lotus 1-2-3 leap year bug +1)
        return Math.floor((d.getTime() / 86400000) + 25569);
      } catch (_) {
        return dateStr;
      }
    }

    // Build data rows as AOA (array of arrays) for fine-grained cell control
    const aoa = [headers];
    for (const row of rows) {
      aoa.push([
        row.address,
        row.suburb,
        row.region,
        row.classification,
        row.status,
        row.price,
        row.price_guide,
        row.net_rent,
        row.yld,
        row.wale,
        row.land_area,
        row.land_rate,
        row.floor_area,
        row.zoning,
        row.agent1,
        row.agent2,
        row.vendor,
        row.purchaser,
        dateSerial(row.sale_date),
        dateSerial(row.settlement_date),
        row.process,
        row.operator,
        row.places,
        row.price_per_place,
        row.rent_per_place,
        row.comments,
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Column index → format mapping (0-based, header row 0, data starts row 1)
    const colFmts = {
      5:  FMT_CURRENCY,   // Sale Price
      6:  FMT_CURRENCY,   // Price Guide
      7:  FMT_CURRENCY,   // Net Rent
      8:  FMT_YIELD,      // Yield %
      10: FMT_AREA,       // Land Area m²
      11: FMT_LAND_RATE,  // Land $/m²
      12: FMT_AREA,       // Floor Area m²
      18: FMT_DATE,       // Sale Date
      19: FMT_DATE,       // Settlement Date
      23: FMT_CURRENCY,   // $/Place
      24: FMT_CURRENCY,   // Rent/Place
    };

    // Apply formats to every data cell in each formatted column
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let R = 1; R <= range.e.r; R++) {
      for (const [C, fmt] of Object.entries(colFmts)) {
        const addr = XLSX.utils.encode_cell({ r: R, c: Number(C) });
        if (ws[addr]) {
          if (!ws[addr].s) ws[addr].s = {};
          ws[addr].s.numFmt = fmt;
          // For date serials, set type to 'n'
          if (fmt === FMT_DATE && typeof ws[addr].v === 'number') {
            ws[addr].t = 'n';
          }
        }
      }
    }

    // Set sensible column widths
    ws['!cols'] = [
      { wch: 35 }, { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 10 },
      { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 8 },
      { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 20 },
      { wch: 25 }, { wch: 25 }, { wch: 20 }, { wch: 20 },
      { wch: 14 }, { wch: 14 }, { wch: 14 },
      { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 40 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'NSW Sales');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', cellStyles: true });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="CW_NSW_Sales.xlsx"');
    res.send(buf);
  } catch (err) {
    console.error('[GET /api/export]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CATCH-ALL (SPA)
// ═══════════════════════════════════════════════════════════════════════════

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ═══════════════════════════════════════════════════════════════════════════
// SCHEDULED SCRAPING
// ═══════════════════════════════════════════════════════════════════════════

cron.schedule('0 */2 * * *', () => {
  console.log('[cron] Running scheduled scrape...');
  runScraper(db).catch(e => console.error('[cron] Scrape error:', e.message));
});

// ═══════════════════════════════════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════════════════════════════════

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`CW NSW Sales running on port ${PORT}`);
  // Initial scrape after 10 seconds
  setTimeout(() => {
    console.log('[startup] Running initial scrape...');
    runScraper(db).catch(e => console.error('[startup] Scrape error:', e.message));
  }, 10000);
});
