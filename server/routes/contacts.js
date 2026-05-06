'use strict';
const { Router } = require('express');
const { db, contactCompleteness } = require('../db');

const router = Router();

function enrich(rows) {
  return rows.map(c => ({ ...c, ...contactCompleteness(c) }));
}

// ── LIST ───────────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const { q, developer_id, linkedin_status, incomplete, owner, follow_up_due } = req.query;

  let sql = `
    SELECT c.*, d.name AS developer_name
    FROM contacts c
    LEFT JOIN developers d ON d.id = c.developer_id
  `;
  const conditions = [];
  const params = [];

  if (developer_id)    { conditions.push(`c.developer_id = ?`);          params.push(developer_id); }
  if (linkedin_status) { conditions.push(`c.linkedin_status = ?`);        params.push(linkedin_status); }
  if (owner)           { conditions.push(`c.relationship_owner LIKE ?`);  params.push(`%${owner}%`); }

  if (follow_up_due === 'true') {
    conditions.push(`c.follow_up_date IS NOT NULL AND c.follow_up_date <= date('now')`);
  }

  if (q) {
    conditions.push(`(c.first_name LIKE ? OR c.last_name LIKE ? OR c.email LIKE ? OR c.title LIKE ? OR d.name LIKE ?)`);
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }

  if (conditions.length) sql += ` WHERE ` + conditions.join(' AND ');
  sql += ` ORDER BY c.last_name ASC, c.first_name ASC`;

  let rows = db.prepare(sql).all(...params);

  // Filter incomplete after enrichment (JS-side)
  rows = enrich(rows);
  if (incomplete === 'true') rows = rows.filter(c => !c.complete);

  res.json(rows);
});

// ── GET ONE ────────────────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const contact = db.prepare(`
    SELECT c.*, d.name AS developer_name
    FROM contacts c LEFT JOIN developers d ON d.id = c.developer_id
    WHERE c.id = ?
  `).get(req.params.id);
  if (!contact) return res.status(404).json({ error: 'Not found' });
  res.json({ ...contact, ...contactCompleteness(contact) });
});

// ── CREATE ─────────────────────────────────────────────────────────────────
router.post('/', (req, res) => {
  const {
    developer_id, first_name, last_name, title, company_override,
    phone, email, linkedin_url, last_contact_date, follow_up_date,
    source, notes, relationship_owner
  } = req.body;

  if (!first_name || !last_name) return res.status(400).json({ error: 'first_name and last_name are required' });

  const result = db.prepare(`
    INSERT INTO contacts
      (developer_id, first_name, last_name, title, company_override,
       phone, email, linkedin_url, last_contact_date, follow_up_date,
       source, notes, relationship_owner)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    developer_id || null, first_name, last_name, title || null, company_override || null,
    phone || null, email || null, linkedin_url || null,
    last_contact_date || null, follow_up_date || null,
    source || null, notes || null, relationship_owner || null
  );

  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ ...contact, ...contactCompleteness(contact) });
});

// ── UPDATE ─────────────────────────────────────────────────────────────────
router.put('/:id', (req, res) => {
  if (!db.prepare('SELECT id FROM contacts WHERE id = ?').get(req.params.id))
    return res.status(404).json({ error: 'Not found' });

  const {
    developer_id, first_name, last_name, title, company_override,
    phone, email, linkedin_url, linkedin_status, last_contact_date,
    follow_up_date, source, notes, relationship_owner
  } = req.body;

  db.prepare(`
    UPDATE contacts SET
      developer_id=?, first_name=?, last_name=?, title=?, company_override=?,
      phone=?, email=?, linkedin_url=?, linkedin_status=?, last_contact_date=?,
      follow_up_date=?, source=?, notes=?, relationship_owner=?
    WHERE id=?
  `).run(
    developer_id || null, first_name, last_name, title || null, company_override || null,
    phone || null, email || null, linkedin_url || null,
    linkedin_status || 'Unchecked', last_contact_date || null, follow_up_date || null,
    source || null, notes || null, relationship_owner || null,
    req.params.id
  );

  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
  res.json({ ...contact, ...contactCompleteness(contact) });
});

// ── LinkedIn status update (partial) ──────────────────────────────────────
router.patch('/:id/linkedin', (req, res) => {
  const { linkedin_status, linkedin_snapshot, reviewer_notes } = req.body;
  if (!db.prepare('SELECT id FROM contacts WHERE id = ?').get(req.params.id))
    return res.status(404).json({ error: 'Not found' });

  db.prepare(`
    UPDATE contacts SET linkedin_status=?, linkedin_snapshot=? WHERE id=?
  `).run(
    linkedin_status || 'Unchecked',
    linkedin_snapshot ? JSON.stringify(linkedin_snapshot) : null,
    req.params.id
  );

  res.json(db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id));
});

// ── DELETE ─────────────────────────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  if (!db.prepare('SELECT id FROM contacts WHERE id = ?').get(req.params.id))
    return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM contacts WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── EXPORT CSV ─────────────────────────────────────────────────────────────
router.get('/export/csv', (req, res) => {
  const rows = db.prepare(`
    SELECT c.*, d.name AS developer_name FROM contacts c
    LEFT JOIN developers d ON d.id = c.developer_id
    ORDER BY c.last_name, c.first_name
  `).all();
  const headers = ['id','developer_name','first_name','last_name','title','company_override',
                   'phone','email','linkedin_url','linkedin_status','last_contact_date',
                   'follow_up_date','relationship_owner','source','notes','created_at','updated_at'];
  const csv = [
    headers.join(','),
    ...rows.map(r => headers.map(h => `"${(r[h] ?? '').toString().replace(/"/g, '""')}"`).join(','))
  ].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="contacts.csv"');
  res.send(csv);
});

module.exports = router;
