'use strict';
const { Router } = require('express');
const { db } = require('../db');

const router = Router();

// ── LIST (with filters) ────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const { q, developer_id, type, status, suburb, funder, valuer, planning_status } = req.query;

  let sql = `
    SELECT p.*, d.name AS developer_name
    FROM projects p
    LEFT JOIN developers d ON d.id = p.developer_id
  `;
  const conditions = [];
  const params = [];

  if (developer_id)    { conditions.push(`p.developer_id = ?`);        params.push(developer_id); }
  if (type)            { conditions.push(`p.project_type = ?`);         params.push(type); }
  if (status)          { conditions.push(`p.status = ?`);               params.push(status); }
  if (planning_status) { conditions.push(`p.planning_status = ?`);      params.push(planning_status); }
  if (suburb)          { conditions.push(`p.suburb LIKE ?`);            params.push(`%${suburb}%`); }
  if (funder)          { conditions.push(`p.funder LIKE ?`);            params.push(`%${funder}%`); }
  if (valuer)          { conditions.push(`p.valuer LIKE ?`);            params.push(`%${valuer}%`); }
  if (q) {
    conditions.push(`(p.name LIKE ? OR p.address LIKE ? OR p.suburb LIKE ? OR d.name LIKE ?)`);
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }

  if (conditions.length) sql += ` WHERE ` + conditions.join(' AND ');
  sql += ` ORDER BY p.updated_at DESC`;

  const rows = db.prepare(sql).all(...params);

  // Attach latest intel snippet to each project
  const intelStmt = db.prepare('SELECT content, intel_date, source FROM intel WHERE project_id = ? ORDER BY intel_date DESC LIMIT 1');
  rows.forEach(r => { r.latest_intel = intelStmt.get(r.id) || null; });

  res.json(rows);
});

// ── GET ONE ────────────────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const project = db.prepare(`
    SELECT p.*, d.name AS developer_name
    FROM projects p LEFT JOIN developers d ON d.id = p.developer_id
    WHERE p.id = ?
  `).get(req.params.id);

  if (!project) return res.status(404).json({ error: 'Not found' });

  project.intel = db.prepare('SELECT * FROM intel WHERE project_id = ? ORDER BY intel_date DESC').all(project.id);
  res.json(project);
});

// ── CREATE ─────────────────────────────────────────────────────────────────
router.post('/', (req, res) => {
  const {
    developer_id, name, address, suburb, state, project_type, status,
    planning_status, estimated_value, lot_count, funder, valuer,
    sales_agent, sales_history, notes
  } = req.body;

  if (!developer_id) return res.status(400).json({ error: 'developer_id is required' });
  if (!name)         return res.status(400).json({ error: 'name is required' });

  const result = db.prepare(`
    INSERT INTO projects
      (developer_id, name, address, suburb, state, project_type, status,
       planning_status, estimated_value, lot_count, funder, valuer,
       sales_agent, sales_history, notes)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    developer_id, name, address || null, suburb || null, state || 'NSW',
    project_type || null, status || 'Active', planning_status || null,
    estimated_value || null, lot_count || null, funder || null, valuer || null,
    sales_agent || null, sales_history || null, notes || null
  );

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(project);
});

// ── UPDATE ─────────────────────────────────────────────────────────────────
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM projects WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const {
    developer_id, name, address, suburb, state, project_type, status,
    planning_status, estimated_value, lot_count, funder, valuer,
    sales_agent, sales_history, notes
  } = req.body;

  db.prepare(`
    UPDATE projects SET
      developer_id=?, name=?, address=?, suburb=?, state=?, project_type=?,
      status=?, planning_status=?, estimated_value=?, lot_count=?, funder=?,
      valuer=?, sales_agent=?, sales_history=?, notes=?
    WHERE id=?
  `).run(
    developer_id, name, address || null, suburb || null, state || 'NSW',
    project_type || null, status || 'Active', planning_status || null,
    estimated_value || null, lot_count || null, funder || null, valuer || null,
    sales_agent || null, sales_history || null, notes || null,
    req.params.id
  );

  res.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id));
});

// ── DELETE ─────────────────────────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  if (!db.prepare('SELECT id FROM projects WHERE id = ?').get(req.params.id))
    return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── EXPORT CSV ─────────────────────────────────────────────────────────────
router.get('/export/csv', (req, res) => {
  const rows = db.prepare(`
    SELECT p.*, d.name AS developer_name FROM projects p
    LEFT JOIN developers d ON d.id = p.developer_id
    ORDER BY p.updated_at DESC
  `).all();
  const headers = ['id','developer_name','name','address','suburb','state','project_type',
                   'status','planning_status','estimated_value','lot_count','funder','valuer',
                   'sales_agent','notes','created_at','updated_at'];
  const csv = [
    headers.join(','),
    ...rows.map(r => headers.map(h => `"${(r[h] ?? '').toString().replace(/"/g, '""')}"`).join(','))
  ].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="projects.csv"');
  res.send(csv);
});

module.exports = router;
