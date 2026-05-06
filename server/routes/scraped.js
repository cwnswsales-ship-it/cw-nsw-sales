'use strict';
const { Router } = require('express');
const { db } = require('../db');

const router = Router();

// ── LIST (pending by default) ──────────────────────────────────────────────
router.get('/', (req, res) => {
  const { status = 'Pending', source, q } = req.query;
  let sql = `SELECT * FROM scraped_leads`;
  const conditions = [];
  const params = [];

  if (status !== 'all') { conditions.push(`review_status = ?`); params.push(status); }
  if (source)           { conditions.push(`source_name = ?`);   params.push(source); }
  if (q) {
    conditions.push(`(developer_name LIKE ? OR project_name LIKE ? OR address LIKE ?)`);
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  if (conditions.length) sql += ` WHERE ` + conditions.join(' AND ');
  sql += ` ORDER BY scraped_at DESC`;

  res.json(db.prepare(sql).all(...params));
});

// ── REVIEW: approve / reject / mark duplicate ──────────────────────────────
router.patch('/:id/review', (req, res) => {
  const lead = db.prepare('SELECT * FROM scraped_leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Not found' });

  const { review_status, reviewer_notes, reviewed_by } = req.body;
  const validStatuses = ['Approved', 'Rejected', 'Duplicate'];
  if (!validStatuses.includes(review_status))
    return res.status(400).json({ error: `review_status must be one of: ${validStatuses.join(', ')}` });

  db.prepare(`
    UPDATE scraped_leads
    SET review_status=?, reviewer_notes=?, reviewed_by=?, reviewed_at=datetime('now')
    WHERE id=?
  `).run(review_status, reviewer_notes || null, reviewed_by || null, req.params.id);

  res.json(db.prepare('SELECT * FROM scraped_leads WHERE id = ?').get(req.params.id));
});

// ── APPROVE → promote to developer + project ──────────────────────────────
// If approved, optionally create developer and/or project records.
router.post('/:id/promote', (req, res) => {
  const lead = db.prepare('SELECT * FROM scraped_leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Not found' });

  const { developer_id, create_developer, create_project, reviewed_by } = req.body;

  let devId = developer_id || null;

  const promote = db.transaction(() => {
    // Optionally create a new developer record
    if (create_developer && !devId) {
      const r = db.prepare(`
        INSERT INTO developers (name, suburb) VALUES (?, ?)
      `).run(lead.developer_name || 'Unknown Developer', lead.suburb || null);
      devId = r.lastInsertRowid;
    }

    let projectId = null;
    if (create_project && devId) {
      const r = db.prepare(`
        INSERT INTO projects (developer_id, name, address, suburb, project_type, status, notes)
        VALUES (?, ?, ?, ?, ?, 'Active', ?)
      `).run(
        devId,
        lead.project_name || lead.address || 'Unnamed Project',
        lead.address || null,
        lead.suburb || null,
        lead.project_type || null,
        `Promoted from scraped lead. Source: ${lead.source_name}. ${lead.raw_snippet || ''}`
      );
      projectId = r.lastInsertRowid;

      // Log intel entry from the scrape
      if (lead.raw_snippet) {
        db.prepare(`
          INSERT INTO intel (project_id, developer_id, content, source, source_url, added_by)
          VALUES (?, ?, ?, 'Press', ?, ?)
        `).run(projectId, devId, lead.raw_snippet, lead.source_url || null, reviewed_by || 'System');
      }
    }

    // Mark the lead as approved
    db.prepare(`
      UPDATE scraped_leads SET review_status='Approved', reviewed_by=?, reviewed_at=datetime('now') WHERE id=?
    `).run(reviewed_by || null, lead.id);

    return { developer_id: devId, project_id: projectId };
  });

  res.json(promote());
});

// ── DELETE ─────────────────────────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  if (!db.prepare('SELECT id FROM scraped_leads WHERE id = ?').get(req.params.id))
    return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM scraped_leads WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Ingest scraped items (called by scraper worker) ───────────────────────
router.post('/ingest', (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body];
  const inserted = [];

  const insert = db.prepare(`
    INSERT INTO scraped_leads
      (developer_name, project_name, address, suburb, project_type,
       status, funder, valuer, source_name, source_url, raw_snippet, confidence)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `);

  const ingest = db.transaction(() => {
    for (const item of items) {
      if (!item.source_name) continue;
      const r = insert.run(
        item.developer_name || null, item.project_name || null,
        item.address || null, item.suburb || null, item.project_type || null,
        item.status || null, item.funder || null, item.valuer || null,
        item.source_name, item.source_url || null,
        item.raw_snippet || null, item.confidence || 'Low'
      );
      inserted.push(r.lastInsertRowid);
    }
  });

  ingest();
  res.status(201).json({ inserted: inserted.length, ids: inserted });
});

module.exports = router;
