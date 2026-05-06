'use strict';
const { Router } = require('express');
const { db } = require('../db');

const router = Router();

// ── LIST (feed, newest first) ──────────────────────────────────────────────
router.get('/', (req, res) => {
  const { project_id, developer_id, source, q, limit = 50, offset = 0 } = req.query;

  let sql = `
    SELECT i.*,
           p.name AS project_name, p.suburb AS project_suburb,
           d.name AS developer_name
    FROM intel i
    LEFT JOIN projects p   ON p.id = i.project_id
    LEFT JOIN developers d ON d.id = COALESCE(i.developer_id, p.developer_id)
  `;
  const conditions = [];
  const params = [];

  if (project_id)   { conditions.push(`i.project_id = ?`);   params.push(project_id); }
  if (developer_id) { conditions.push(`(i.developer_id = ? OR p.developer_id = ?)`); params.push(developer_id, developer_id); }
  if (source)       { conditions.push(`i.source = ?`);        params.push(source); }
  if (q)            { conditions.push(`i.content LIKE ?`);    params.push(`%${q}%`); }

  if (conditions.length) sql += ` WHERE ` + conditions.join(' AND ');
  sql += ` ORDER BY i.intel_date DESC, i.created_at DESC LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), parseInt(offset));

  res.json(db.prepare(sql).all(...params));
});

// ── CREATE ─────────────────────────────────────────────────────────────────
router.post('/', (req, res) => {
  const { project_id, developer_id, content, source, source_url, added_by, intel_date } = req.body;
  if (!content) return res.status(400).json({ error: 'content is required' });

  const result = db.prepare(`
    INSERT INTO intel (project_id, developer_id, content, source, source_url, added_by, intel_date)
    VALUES (?,?,?,?,?,?,?)
  `).run(
    project_id || null, developer_id || null, content,
    source || 'Internal', source_url || null, added_by || null,
    intel_date || new Date().toISOString().slice(0, 10)
  );

  const row = db.prepare(`
    SELECT i.*, p.name AS project_name, d.name AS developer_name
    FROM intel i
    LEFT JOIN projects p ON p.id = i.project_id
    LEFT JOIN developers d ON d.id = COALESCE(i.developer_id, p.developer_id)
    WHERE i.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(row);
});

// ── DELETE ─────────────────────────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  if (!db.prepare('SELECT id FROM intel WHERE id = ?').get(req.params.id))
    return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM intel WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
