'use strict';
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'crm.db');

// Ensure data directory exists
const fs = require('fs');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Performance pragmas
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── SCHEMA ────────────────────────────────────────────────────────────────

db.exec(`

  -- Lookup / reference tables
  CREATE TABLE IF NOT EXISTS tags (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    colour      TEXT NOT NULL DEFAULT '#6B7490'
  );

  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    email       TEXT,
    role        TEXT NOT NULL DEFAULT 'Agent',
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ── Developers ────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS developers (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    name                TEXT NOT NULL,
    abn                 TEXT,
    type                TEXT,          -- 'Residential', 'Commercial', 'Mixed', 'Industrial', 'Childcare', 'Other'
    website             TEXT,
    suburb              TEXT,
    state               TEXT NOT NULL DEFAULT 'NSW',
    relationship_owner  TEXT,          -- internal CW agent
    notes               TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS developer_tags (
    developer_id  INTEGER NOT NULL REFERENCES developers(id) ON DELETE CASCADE,
    tag_id        INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (developer_id, tag_id)
  );

  -- ── Projects ──────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS projects (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    developer_id      INTEGER NOT NULL REFERENCES developers(id) ON DELETE CASCADE,
    name              TEXT NOT NULL,
    address           TEXT,
    suburb            TEXT,
    state             TEXT NOT NULL DEFAULT 'NSW',
    project_type      TEXT,   -- 'Residential', 'Commercial', 'Mixed Use', 'Industrial', 'Childcare', 'Land'
    status            TEXT NOT NULL DEFAULT 'Active',
                              -- 'Active', 'Planning', 'Under Construction', 'Completed', 'On Hold', 'Withdrawn'
    planning_status   TEXT,   -- 'DA Pending', 'DA Approved', 'CDC', 'Construction Certificate', 'Completed'
    estimated_value   REAL,   -- AUD
    lot_count         INTEGER,
    funder            TEXT,
    valuer            TEXT,
    sales_agent       TEXT,
    sales_history     TEXT,   -- free text / JSON snapshot
    notes             TEXT,
    created_at        TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ── Intel updates (log against a project or developer) ───────────────────
  CREATE TABLE IF NOT EXISTS intel (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id    INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    developer_id  INTEGER REFERENCES developers(id) ON DELETE SET NULL,
    content       TEXT NOT NULL,
    source        TEXT,         -- 'Internal', 'Press', 'DA Portal', 'Agent', 'LinkedIn', 'Other'
    source_url    TEXT,
    added_by      TEXT,
    intel_date    TEXT NOT NULL DEFAULT (date('now')),
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ── Contacts ──────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS contacts (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    developer_id        INTEGER REFERENCES developers(id) ON DELETE SET NULL,
    first_name          TEXT NOT NULL,
    last_name           TEXT NOT NULL,
    title               TEXT,          -- job title
    company_override    TEXT,          -- if different from developer name
    phone               TEXT,
    email               TEXT,
    linkedin_url        TEXT,
    linkedin_snapshot   TEXT,          -- JSON: { title, company, snapshotDate }
    linkedin_status     TEXT NOT NULL DEFAULT 'Unchecked',
                                       -- 'Unchecked', 'Current', 'Potential Update', 'Confirmed Changed'
    last_contact_date   TEXT,
    follow_up_date      TEXT,
    source              TEXT,
    notes               TEXT,
    relationship_owner  TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ── Scraped leads (unverified, await user approval) ───────────────────────
  CREATE TABLE IF NOT EXISTS scraped_leads (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    developer_name  TEXT,
    project_name    TEXT,
    address         TEXT,
    suburb          TEXT,
    project_type    TEXT,
    status          TEXT,
    funder          TEXT,
    valuer          TEXT,
    source_name     TEXT NOT NULL,   -- e.g. 'NSW Planning Portal', 'Urban Developer'
    source_url      TEXT,
    raw_snippet     TEXT,            -- excerpt of scraped text
    confidence      TEXT NOT NULL DEFAULT 'Low',  -- 'High', 'Medium', 'Low'
    review_status   TEXT NOT NULL DEFAULT 'Pending',
                                     -- 'Pending', 'Approved', 'Rejected', 'Duplicate'
    reviewer_notes  TEXT,
    scraped_at      TEXT NOT NULL DEFAULT (datetime('now')),
    reviewed_at     TEXT,
    reviewed_by     TEXT
  );

  -- ── Scraper source config ─────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS scraper_sources (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    url         TEXT NOT NULL,
    enabled     INTEGER NOT NULL DEFAULT 1,   -- 0/1 boolean
    respect_robots INTEGER NOT NULL DEFAULT 1,
    notes       TEXT,
    last_run    TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ── Triggers: keep updated_at current ─────────────────────────────────────
  CREATE TRIGGER IF NOT EXISTS developers_updated
    AFTER UPDATE ON developers
    BEGIN UPDATE developers SET updated_at = datetime('now') WHERE id = NEW.id; END;

  CREATE TRIGGER IF NOT EXISTS projects_updated
    AFTER UPDATE ON projects
    BEGIN UPDATE projects SET updated_at = datetime('now') WHERE id = NEW.id; END;

  CREATE TRIGGER IF NOT EXISTS contacts_updated
    AFTER UPDATE ON contacts
    BEGIN UPDATE contacts SET updated_at = datetime('now') WHERE id = NEW.id; END;

`);

// ─── HELPERS ────────────────────────────────────────────────────────────────

/**
 * Attach comma-separated tag names to each developer row.
 */
function attachDeveloperTags(rows) {
  if (!rows.length) return rows;
  const ids = rows.map(r => r.id);
  const tagRows = db.prepare(`
    SELECT dt.developer_id, t.name, t.colour
    FROM developer_tags dt
    JOIN tags t ON t.id = dt.tag_id
    WHERE dt.developer_id IN (${ids.map(() => '?').join(',')})
  `).all(...ids);

  const map = {};
  tagRows.forEach(tr => {
    if (!map[tr.developer_id]) map[tr.developer_id] = [];
    map[tr.developer_id].push({ name: tr.name, colour: tr.colour });
  });

  return rows.map(r => ({ ...r, tags: map[r.id] || [] }));
}

/**
 * Sync tag names (strings) for a developer — insert missing tags, link all.
 */
function syncDeveloperTags(developerId, tagNames = []) {
  db.prepare('DELETE FROM developer_tags WHERE developer_id = ?').run(developerId);
  for (const name of tagNames) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(trimmed);
    const tag = db.prepare('SELECT id FROM tags WHERE name = ?').get(trimmed);
    db.prepare('INSERT OR IGNORE INTO developer_tags (developer_id, tag_id) VALUES (?, ?)').run(developerId, tag.id);
  }
}

/**
 * Returns a contact completeness flag.
 * A contact is "incomplete" if it is missing phone, email, or title.
 */
function contactCompleteness(contact) {
  const missing = [];
  if (!contact.phone) missing.push('phone');
  if (!contact.email) missing.push('email');
  if (!contact.title) missing.push('title');
  return { complete: missing.length === 0, missing };
}

module.exports = { db, attachDeveloperTags, syncDeveloperTags, contactCompleteness };
