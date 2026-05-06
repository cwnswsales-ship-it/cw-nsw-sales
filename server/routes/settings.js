'use strict';
const { Router } = require('express');
const { db } = require('../db');

const router = Router();

// ── Dashboard stats ────────────────────────────────────────────────────────
router.get('/stats', (req, res) => {
  const stats = {
    total_developers:   db.prepare('SELECT COUNT(*) AS n FROM developers').get().n,
    active_projects:    db.prepare(`SELECT COUNT(*) AS n FROM projects WHERE status NOT IN ('Completed','Withdrawn')`).get().n,
    total_projects:     db.prepare('SELECT COUNT(*) AS n FROM projects').get().n,
    total_contacts:     db.prepare('SELECT COUNT(*) AS n FROM contacts').get().n,
    incomplete_contacts:db.prepare(`SELECT COUNT(*) AS n FROM contacts WHERE phone IS NULL OR email IS NULL OR title IS NULL`).get().n,
    pending_leads:      db.prepare(`SELECT COUNT(*) AS n FROM scraped_leads WHERE review_status = 'Potential Update'`).get().n,
    pending_scraped:    db.prepare(`SELECT COUNT(*) AS n FROM scraped_leads WHERE review_status = 'Pending'`).get().n,
    followups_due:      db.prepare(`SELECT COUNT(*) AS n FROM contacts WHERE follow_up_date IS NOT NULL AND follow_up_date <= date('now')`).get().n,
    linkedin_flags:     db.prepare(`SELECT COUNT(*) AS n FROM contacts WHERE linkedin_status = 'Potential Update'`).get().n,
    top_funders: db.prepare(`
      SELECT funder AS name, COUNT(*) AS count
      FROM projects WHERE funder IS NOT NULL AND funder != ''
      GROUP BY funder ORDER BY count DESC LIMIT 5
    `).all(),
    top_valuers: db.prepare(`
      SELECT valuer AS name, COUNT(*) AS count
      FROM projects WHERE valuer IS NOT NULL AND valuer != ''
      GROUP BY valuer ORDER BY count DESC LIMIT 5
    `).all(),
    recent_intel: db.prepare(`
      SELECT i.id, i.content, i.intel_date, i.source,
             p.name AS project_name, d.name AS developer_name
      FROM intel i
      LEFT JOIN projects p   ON p.id = i.project_id
      LEFT JOIN developers d ON d.id = COALESCE(i.developer_id, p.developer_id)
      ORDER BY i.created_at DESC LIMIT 5
    `).all(),
    followup_contacts: db.prepare(`
      SELECT c.id, c.first_name, c.last_name, c.title, c.follow_up_date,
             d.name AS developer_name
      FROM contacts c
      LEFT JOIN developers d ON d.id = c.developer_id
      WHERE c.follow_up_date IS NOT NULL AND c.follow_up_date <= date('now', '+7 days')
      ORDER BY c.follow_up_date ASC LIMIT 8
    `).all(),
  };
  res.json(stats);
});

// ── Scraper sources ────────────────────────────────────────────────────────
router.get('/scraper-sources', (req, res) => {
  res.json(db.prepare('SELECT * FROM scraper_sources ORDER BY name').all());
});

router.post('/scraper-sources', (req, res) => {
  const { name, url, enabled, respect_robots, notes } = req.body;
  if (!name || !url) return res.status(400).json({ error: 'name and url are required' });
  const r = db.prepare(`
    INSERT INTO scraper_sources (name, url, enabled, respect_robots, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run(name, url, enabled ?? 1, respect_robots ?? 1, notes || null);
  res.status(201).json(db.prepare('SELECT * FROM scraper_sources WHERE id = ?').get(r.lastInsertRowid));
});

router.put('/scraper-sources/:id', (req, res) => {
  if (!db.prepare('SELECT id FROM scraper_sources WHERE id = ?').get(req.params.id))
    return res.status(404).json({ error: 'Not found' });
  const { name, url, enabled, respect_robots, notes } = req.body;
  db.prepare(`
    UPDATE scraper_sources SET name=?, url=?, enabled=?, respect_robots=?, notes=? WHERE id=?
  `).run(name, url, enabled ?? 1, respect_robots ?? 1, notes || null, req.params.id);
  res.json(db.prepare('SELECT * FROM scraper_sources WHERE id = ?').get(req.params.id));
});

router.delete('/scraper-sources/:id', (req, res) => {
  if (!db.prepare('SELECT id FROM scraper_sources WHERE id = ?').get(req.params.id))
    return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM scraper_sources WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Tags ───────────────────────────────────────────────────────────────────
router.get('/tags', (req, res) => {
  res.json(db.prepare('SELECT * FROM tags ORDER BY name').all());
});

// ── Users (internal relationship owners) ──────────────────────────────────
router.get('/users', (req, res) => {
  res.json(db.prepare('SELECT * FROM users ORDER BY name').all());
});

router.post('/users', (req, res) => {
  const { name, email, role } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const r = db.prepare('INSERT INTO users (name, email, role) VALUES (?, ?, ?)').run(name, email || null, role || 'Agent');
  res.status(201).json(db.prepare('SELECT * FROM users WHERE id = ?').get(r.lastInsertRowid));
});

router.delete('/users/:id', (req, res) => {
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
