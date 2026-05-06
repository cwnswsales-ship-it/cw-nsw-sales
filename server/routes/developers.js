'use strict';
const { Router } = require('express');
const { db, attachDeveloperTags, syncDeveloperTags } = require('../db');

const router = Router();

// ── LIST (with filters) ────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const { q, type, suburb, funder, valuer, owner, tag } = req.query;

  let sql = `
    SELECT d.*,
           COUNT(DISTINCT p.id)  AS project_count,
           COUNT(DISTINCT c.id)  AS contact_count
    FROM developers d
    LEFT JOIN projects p ON p.developer_id = d.id
    LEFT JOIN contacts c ON c.developer_id = d.id
  `;
  const conditions = [];
  const params = [];

  if (q) {
    conditions.push(`(d.name LIKE ? OR d.suburb LIKE ? OR d.abn LIKE ?)`);
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (type)   { conditions.push(`d.type = ?`);                params.push(type); }
  if (suburb) { conditions.push(`d.suburb LIKE ?`);           params.push(`%${suburb}%`); }
  if (owner)  { conditions.push(`d.relationship_owner LIKE ?`); params.push(`%${owner}%`); }

  // Funder / valuer filters via project join
  if (funder) { conditions.push(`EXISTS (SELECT 1 FROM projects pp WHERE pp.developer_id = d.id AND pp.funder LIKE ?)`); params.push(`%${funder}%`); }
  if (valuer) { conditions.push(`EXISTS (SELECT 1 FROM projects pp WHERE pp.developer_id = d.id AND pp.valuer LIKE ?)`); params.push(`%${valuer}%`); }

  // Tag filter
  if (tag) {
    conditions.push(`EXISTS (
      SELECT 1 FROM developer_tags dt JOIN tags t ON t.id = dt.tag_id
      WHERE dt.developer_id = d.id AND t.name = ?
    )`);
    params.push(tag);
  }

  if (conditions.length) sql += ` WHERE ` + conditions.join(' AND ');
  sql += ` GROUP BY d.id ORDER BY d.name ASC`;

  const rows = db.prepare(sql).all(...params);
  res.json(attachDeveloperTags(rows));
});

// ── GET ONE ────────────────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const dev = db.prepare('SELECT * FROM developers WHERE id = ?').get(req.params.id);
  if (!dev) return res.status(404).json({ error: 'Not found' });

  const [withTags] = attachDeveloperTags([dev]);
  withTags.projects = db.prepare('SELECT * FROM projects WHERE developer_id = ? ORDER BY created_at DESC').all(dev.id);
  withTags.contacts = db.prepare('SELECT * FROM contacts WHERE developer_id = ? ORDER BY last_name ASC').all(dev.id);
  withTags.intel    = db.prepare('SELECT * FROM intel WHERE developer_id = ? ORDER BY intel_date DESC LIMIT 20').all(dev.id);

  res.json(withTags);
});

// ── CREATE ─────────────────────────────────────────────────────────────────
router.post('/', (req, res) => {
  const { name, abn, type, website, suburb, state, relationship_owner, notes, tags = [] } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const result = db.prepare(`
    INSERT INTO developers (name, abn, type, website, suburb, state, relationship_owner, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, abn || null, type || null, website || null, suburb || null, state || 'NSW', relationship_owner || null, notes || null);

  syncDeveloperTags(result.lastInsertRowid, tags);

  const dev = db.prepare('SELECT * FROM developers WHERE id = ?').get(result.lastInsertRowid);
  const [withTags] = attachDeveloperTags([dev]);
  res.status(201).json(withTags);
});

// ── UPDATE ─────────────────────────────────────────────────────────────────
router.put('/:id', (req, res) => {
  const dev = db.prepare('SELECT id FROM developers WHERE id = ?').get(req.params.id);
  if (!dev) return res.status(404).json({ error: 'Not found' });

  const { name, abn, type, website, suburb, state, relationship_owner, notes, tags } = req.body;

  db.prepare(`
    UPDATE developers SET name=?, abn=?, type=?, website=?, suburb=?, state=?,
      relationship_owner=?, notes=? WHERE id=?
  `).run(
    name, abn || null, type || null, website || null, suburb || null,
    state || 'NSW', relationship_owner || null, notes || null, req.params.id
  );

  if (Array.isArray(tags)) syncDeveloperTags(req.params.id, tags);

  const updated = db.prepare('SELECT * FROM developers WHERE id = ?').get(req.params.id);
  const [withTags] = attachDeveloperTags([updated]);
  res.json(withTags);
});

// ── DELETE ─────────────────────────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  const dev = db.prepare('SELECT id FROM developers WHERE id = ?').get(req.params.id);
  if (!dev) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM developers WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── EXPORT CSV ─────────────────────────────────────────────────────────────
router.get('/export/csv', (req, res) => {
  const rows = db.prepare('SELECT * FROM developers ORDER BY name').all();
  const headers = ['id','name','abn','type','suburb','state','website','relationship_owner','notes','created_at','updated_at'];
  const csv = [
    headers.join(','),
    ...rows.map(r => headers.map(h => `"${(r[h] ?? '').toString().replace(/"/g, '""')}"`).join(','))
  ].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="developers.csv"');
  res.send(csv);
});

module.exports = router;
