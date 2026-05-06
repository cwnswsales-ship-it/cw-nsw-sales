'use strict';
// Run with: node server/seed.js
// Adds sample records only if the database is empty.
// Use --force flag to wipe and re-seed: node server/seed.js --force

const { db, syncDeveloperTags } = require('./db');

function seed(force = false) {
  const existing = db.prepare('SELECT COUNT(*) AS n FROM developers').get().n;
  if (existing > 0 && !force) {
    console.log(`Database already has ${existing} developers — skipping seed.`);
    return;
  }

  console.log('Seeding database...');

// ── Wipe existing data ─────────────────────────────────────────────────────
db.exec(`
  DELETE FROM intel;
  DELETE FROM contacts;
  DELETE FROM projects;
  DELETE FROM developer_tags;
  DELETE FROM developers;
  DELETE FROM scraped_leads;
  DELETE FROM scraper_sources;
  DELETE FROM users;
  DELETE FROM tags;
`);

// ── Tags ───────────────────────────────────────────────────────────────────
const tagData = [
  { name: 'Active Pipeline',   colour: '#1E6B45' },
  { name: 'High Value',        colour: '#1B2A4A' },
  { name: 'Watch List',        colour: '#D97706' },
  { name: 'Foreign Developer', colour: '#7C3AED' },
  { name: 'Repeat Client',     colour: '#1565C0' },
  { name: 'New Contact',       colour: '#6B7490' },
];
const insertTag = db.prepare('INSERT INTO tags (name, colour) VALUES (?, ?)');
tagData.forEach(t => insertTag.run(t.name, t.colour));

// ── Users ──────────────────────────────────────────────────────────────────
const users = [
  { name: 'James Thorpe',   email: 'j.thorpe@cushmanwakefield.com',   role: 'Director' },
  { name: 'Sarah Mitchell', email: 's.mitchell@cushmanwakefield.com', role: 'Senior Agent' },
  { name: 'Ben Kavanaugh',  email: 'b.kavanaugh@cushmanwakefield.com',role: 'Agent' },
  { name: 'Priya Nair',     email: 'p.nair@cushmanwakefield.com',     role: 'Agent' },
];
const insertUser = db.prepare('INSERT INTO users (name, email, role) VALUES (?, ?, ?)');
users.forEach(u => insertUser.run(u.name, u.email, u.role));

// ── Developers ─────────────────────────────────────────────────────────────
const insertDev = db.prepare(`
  INSERT INTO developers (name, abn, type, website, suburb, state, relationship_owner, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const devData = [
  {
    name: 'Meriton Group',
    abn: '44 000 000 001',
    type: 'Residential',
    website: 'https://www.meriton.com.au',
    suburb: 'Mascot',
    owner: 'James Thorpe',
    notes: 'Australia\'s largest apartment developer. Active across multiple Sydney precincts.',
    tags: ['Active Pipeline', 'High Value', 'Repeat Client'],
  },
  {
    name: 'Frasers Property Australia',
    abn: '44 000 000 002',
    type: 'Mixed',
    website: 'https://www.fraserspropertyaustralia.com.au',
    suburb: 'Rhodes',
    owner: 'Sarah Mitchell',
    notes: 'Listed developer with significant NSW pipeline. Strong relationship with ANZ.',
    tags: ['Active Pipeline', 'High Value'],
  },
  {
    name: 'Aqualand',
    abn: '44 000 000 003',
    type: 'Residential',
    website: 'https://www.aqualand.com.au',
    suburb: 'Milsons Point',
    owner: 'James Thorpe',
    notes: 'Chinese-backed developer. Luxury residential focus. Key contacts in Sydney CBD.',
    tags: ['Foreign Developer', 'High Value'],
  },
  {
    name: 'Coronation Property Group',
    abn: '44 000 000 004',
    type: 'Mixed',
    website: 'https://www.coronation.com.au',
    suburb: 'Pyrmont',
    owner: 'Ben Kavanaugh',
    notes: 'Strong activity in inner west. Interested in mixed-use and BTR opportunities.',
    tags: ['Active Pipeline', 'Watch List'],
  },
  {
    name: 'Altis Property Partners',
    abn: '44 000 000 005',
    type: 'Commercial',
    website: 'https://www.altis.com.au',
    suburb: 'North Sydney',
    owner: 'Priya Nair',
    notes: 'Institutional fund manager. Office and industrial focus.',
    tags: ['High Value'],
  },
  {
    name: 'Urban Rest',
    abn: '44 000 000 006',
    type: 'Residential',
    website: 'https://www.urbanrest.com.au',
    suburb: 'Surry Hills',
    owner: 'Ben Kavanaugh',
    notes: 'BTR / serviced apartment operator. Growing portfolio across Eastern Seaboard.',
    tags: ['New Contact', 'Watch List'],
  },
];

const devIds = {};
devData.forEach(d => {
  const r = insertDev.run(d.name, d.abn, d.type, d.website, d.suburb, 'NSW', d.owner, d.notes);
  devIds[d.name] = r.lastInsertRowid;
  syncDeveloperTags(r.lastInsertRowid, d.tags);
});

// ── Projects ───────────────────────────────────────────────────────────────
const insertProject = db.prepare(`
  INSERT INTO projects
    (developer_id, name, address, suburb, state, project_type, status,
     planning_status, estimated_value, lot_count, funder, valuer, sales_agent, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const projectData = [
  {
    dev: 'Meriton Group',
    name: 'World Tower Residences – Stage 3',
    address: '1 Market Street',
    suburb: 'Sydney CBD',
    type: 'Residential',
    status: 'Under Construction',
    planning: 'Construction Certificate',
    value: 420000000,
    lots: 340,
    funder: 'Westpac',
    valuer: 'JLL',
    agent: 'James Thorpe',
    notes: 'Stage 3 tower, completion expected Q3 2026. Pre-sales 85% sold.',
  },
  {
    dev: 'Meriton Group',
    name: 'Mascot Central',
    address: '810 Botany Road',
    suburb: 'Mascot',
    type: 'Residential',
    status: 'Planning',
    planning: 'DA Pending',
    value: 180000000,
    lots: 210,
    funder: 'NAB',
    valuer: 'CBRE',
    agent: 'James Thorpe',
    notes: 'DA lodged Feb 2025. Awaiting Council response. 40-storey mixed tower.',
  },
  {
    dev: 'Frasers Property Australia',
    name: 'Central Park Rhodes',
    address: '1 Rider Boulevard',
    suburb: 'Rhodes',
    type: 'Mixed Use',
    status: 'Active',
    planning: 'DA Approved',
    value: 650000000,
    lots: 520,
    funder: 'ANZ',
    valuer: 'Knight Frank',
    agent: 'Sarah Mitchell',
    notes: 'Masterplan approved. Retail podium and 4 residential towers. EOI launched.',
  },
  {
    dev: 'Aqualand',
    name: 'North Sydney Luxury Residences',
    address: '88 Walker Street',
    suburb: 'North Sydney',
    type: 'Residential',
    status: 'Under Construction',
    planning: 'Construction Certificate',
    value: 310000000,
    lots: 190,
    funder: 'China Construction Bank',
    valuer: 'Savills',
    agent: 'James Thorpe',
    notes: 'Premium product. Strong Asian buyer base. Expected settlement Q2 2026.',
  },
  {
    dev: 'Coronation Property Group',
    name: 'Pyrmont Peninsula – Block E',
    address: '21 Harris Street',
    suburb: 'Pyrmont',
    type: 'Mixed Use',
    status: 'Planning',
    planning: 'DA Pending',
    value: 290000000,
    lots: 280,
    funder: 'Commonwealth Bank',
    valuer: 'JLL',
    agent: 'Ben Kavanaugh',
    notes: 'Part of broader Pyrmont Peninsula precinct. Discussions with City of Sydney ongoing.',
  },
  {
    dev: 'Altis Property Partners',
    name: 'Chatswood Office Campus',
    address: '67 Albert Avenue',
    suburb: 'Chatswood',
    type: 'Commercial',
    status: 'Completed',
    planning: 'Completed',
    value: 220000000,
    lots: null,
    funder: 'Macquarie Bank',
    valuer: 'Colliers',
    agent: 'Priya Nair',
    notes: 'A-grade office, 18,000sqm NLA. Fully leased. Potential divestment opportunity.',
  },
  {
    dev: 'Urban Rest',
    name: 'Surry Hills BTR Tower',
    address: '349 Crown Street',
    suburb: 'Surry Hills',
    type: 'Residential',
    status: 'Planning',
    planning: 'DA Pending',
    value: 95000000,
    lots: 120,
    funder: 'TBC',
    valuer: 'CBRE',
    agent: 'Ben Kavanaugh',
    notes: 'Build-to-rent concept. Operator pre-committed. Funding discussions underway.',
  },
];

const projectIds = {};
projectData.forEach(p => {
  const r = insertProject.run(
    devIds[p.dev], p.name, p.address, p.suburb, 'NSW',
    p.type, p.status, p.planning, p.value, p.lots,
    p.funder, p.valuer, p.agent, p.notes
  );
  projectIds[p.name] = r.lastInsertRowid;
});

// ── Contacts ───────────────────────────────────────────────────────────────
const insertContact = db.prepare(`
  INSERT INTO contacts
    (developer_id, first_name, last_name, title, phone, email, linkedin_url,
     linkedin_status, last_contact_date, follow_up_date, source, notes, relationship_owner)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const today = new Date();
const daysAgo = n => new Date(today - n * 864e5).toISOString().slice(0,10);
const daysAhead = n => new Date(today.getTime() + n * 864e5).toISOString().slice(0,10);

const contactData = [
  { dev: 'Meriton Group',            fn: 'Harry',   ln: 'Triguboff',  title: 'Chairman & Managing Director', phone: '+61 2 9287 0000', email: 'h.triguboff@meriton.com.au', li: 'https://linkedin.com/in/harry-triguboff', liStatus: 'Current',          lc: daysAgo(14),   fu: daysAhead(30), src: 'Direct', owner: 'James Thorpe',   notes: 'Founder. High-level relationship. Contact only for major transactions.' },
  { dev: 'Meriton Group',            fn: 'David',   ln: 'Cremona',    title: 'Development Director',          phone: '+61 2 9287 0100', email: 'd.cremona@meriton.com.au',    li: 'https://linkedin.com/in/david-cremona',    liStatus: 'Current',          lc: daysAgo(7),    fu: daysAhead(14), src: 'Direct', owner: 'James Thorpe',   notes: 'Day-to-day contact for development pipeline queries.' },
  { dev: 'Frasers Property Australia',fn: 'Peta',   ln: 'Boyes',      title: 'Development Manager',           phone: '+61 2 8823 8888', email: 'p.boyes@frasersproperty.com', li: 'https://linkedin.com/in/peta-boyes',       liStatus: 'Potential Update', lc: daysAgo(45),   fu: daysAhead(7),  src: 'Referral', owner: 'Sarah Mitchell', notes: 'Moved from Mirvac early 2024. Confirm current role.' },
  { dev: 'Frasers Property Australia',fn: 'Anthony',ln: 'Boyd',       title: 'CEO',                           phone: '+61 2 8823 8800', email: 'a.boyd@frasersproperty.com',  li: 'https://linkedin.com/in/anthony-boyd-fpa', liStatus: 'Current',          lc: daysAgo(60),   fu: daysAhead(21), src: 'Event', owner: 'Sarah Mitchell', notes: 'Met at UDIA lunch March 2025.' },
  { dev: 'Aqualand',                 fn: 'Jin',     ln: 'Lin',        title: 'Managing Director',             phone: '+61 2 8262 2888', email: 'j.lin@aqualand.com.au',       li: 'https://linkedin.com/in/jin-lin-aqualand',  liStatus: 'Unchecked',        lc: daysAgo(30),   fu: daysAhead(10), src: 'Direct', owner: 'James Thorpe',   notes: 'Key decision maker. Prefers email over phone.' },
  { dev: 'Coronation Property Group', fn: 'Joseph', ln: 'Nahas',      title: 'Managing Director',             phone: '+61 2 8078 0000', email: 'j.nahas@coronation.com.au',   li: 'https://linkedin.com/in/joseph-nahas',     liStatus: 'Current',          lc: daysAgo(21),   fu: daysAhead(5),  src: 'Direct', owner: 'Ben Kavanaugh',  notes: 'Prefers breakfast meetings. Lives in Pyrmont.' },
  { dev: 'Coronation Property Group', fn: 'Tom',    ln: 'Walker',     title: 'Head of Acquisitions',          phone: null,              email: 't.walker@coronation.com.au',  li: null,                                        liStatus: 'Unchecked',        lc: daysAgo(90),   fu: null,          src: 'LinkedIn', owner: 'Ben Kavanaugh',  notes: 'Met at REINSW event. No phone on file.' },
  { dev: 'Altis Property Partners',  fn: 'Ken',     ln: 'Morrison',   title: 'Portfolio Manager',             phone: '+61 2 9231 0000', email: 'k.morrison@altis.com.au',     li: 'https://linkedin.com/in/ken-morrison-altis', liStatus: 'Confirmed Changed', lc: daysAgo(120),  fu: daysAhead(3),  src: 'Referral', owner: 'Priya Nair',     notes: 'LinkedIn shows moved to BlackRock. Needs urgent verification.' },
  { dev: 'Urban Rest',               fn: 'Melissa', ln: 'Caddick',    title: null,                            phone: '+61 412 000 000',  email: null,                          li: 'https://linkedin.com/in/melissa-caddick',  liStatus: 'Unchecked',        lc: null,          fu: daysAhead(2),  src: 'Cold Outreach', owner: 'Ben Kavanaugh', notes: 'Incomplete record. Follow up urgently.' },
];

contactData.forEach(c => {
  insertContact.run(
    devIds[c.dev], c.fn, c.ln, c.title || null,
    c.phone || null, c.email || null, c.li || null,
    c.liStatus || 'Unchecked', c.lc || null, c.fu || null,
    c.src || null, c.notes || null, c.owner || null
  );
});

// ── Intel updates ──────────────────────────────────────────────────────────
const insertIntel = db.prepare(`
  INSERT INTO intel (project_id, developer_id, content, source, source_url, added_by, intel_date)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const intelData = [
  { proj: 'World Tower Residences – Stage 3', dev: 'Meriton Group', content: 'Site inspection confirmed crane erected. Concrete poured to level 14. On track for Q3 2026 completion.', source: 'Internal', url: null, by: 'James Thorpe', date: daysAgo(3) },
  { proj: 'World Tower Residences – Stage 3', dev: 'Meriton Group', content: 'Pre-sales tracker updated: 289 of 340 units contracted (85%). Balance of 51 releasing at completion.', source: 'Internal', url: null, by: 'James Thorpe', date: daysAgo(10) },
  { proj: 'Mascot Central', dev: 'Meriton Group', content: 'Council requested additional traffic study. Submission lodged this week. Expect 4-6 week delay to DA determination.', source: 'DA Portal', url: 'https://da.cityofsydney.nsw.gov.au', by: 'Sarah Mitchell', date: daysAgo(5) },
  { proj: 'Central Park Rhodes', dev: 'Frasers Property Australia', content: 'EOI received from 6 qualified purchasers. Highest bid ~$290M for Lot 2A. Board review scheduled for next Thursday.', source: 'Internal', url: null, by: 'Sarah Mitchell', date: daysAgo(2) },
  { proj: 'North Sydney Luxury Residences', dev: 'Aqualand', content: 'Aqualand confirms Q2 2026 settlement date. Agent briefed 88 outstanding buyers. Expected settlement revenue ~$280M.', source: 'Agent', url: null, by: 'James Thorpe', date: daysAgo(8) },
  { proj: 'Pyrmont Peninsula – Block E', dev: 'Coronation Property Group', content: 'City of Sydney advised informal pre-DA meeting scheduled for 22 May 2025. Positive signals on height envelope.', source: 'Agent', url: null, by: 'Ben Kavanaugh', date: daysAgo(1) },
  { proj: 'Surry Hills BTR Tower', dev: 'Urban Rest', content: 'Urban Developer article confirms Urban Rest seeking $95M in debt funding. Westpac and CBRE Capital Markets shortlisted.', source: 'Press', url: 'https://www.theurbandeveloper.com', by: 'Priya Nair', date: daysAgo(4) },
];

intelData.forEach(i => {
  insertIntel.run(
    projectIds[i.proj] || null, devIds[i.dev] || null,
    i.content, i.source, i.url, i.by, i.date
  );
});

// ── Scraped leads ──────────────────────────────────────────────────────────
const insertLead = db.prepare(`
  INSERT INTO scraped_leads
    (developer_name, project_name, address, suburb, project_type, status,
     source_name, source_url, raw_snippet, confidence, review_status)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const leads = [
  { dev: 'Stockland', proj: 'Waterloo Oval Redevelopment', addr: '1 Waterloo Road', suburb: 'Waterloo', type: 'Mixed Use', status: 'Planning', src: 'NSW Planning Portal', url: 'https://www.planningportal.nsw.gov.au', snippet: 'DA lodged April 2025 for 42-storey mixed-use tower at Waterloo. Developer listed as Stockland Group. 380 residential lots plus ground-floor retail.', confidence: 'High' },
  { dev: 'Mirvac', proj: 'Green Square Residences', addr: '1 Joynton Avenue', suburb: 'Zetland', type: 'Residential', status: 'Active', src: 'The Urban Developer', url: 'https://www.theurbandeveloper.com/articles/mirvac-green-square', snippet: 'Mirvac launches sales for 240-apartment project in Green Square. $320M gross realisation expected.', confidence: 'High' },
  { dev: 'Unknown Developer', proj: null, addr: '99 Mount Street', suburb: 'North Sydney', type: 'Commercial', status: null, src: 'Council DA Tracker', url: 'https://northsydney.nsw.gov.au/da', snippet: 'DA 2025/0422 — demolition of existing commercial building and erection of 22-storey office tower. Developer applicant not disclosed.', confidence: 'Low' },
  { dev: 'Lendlease', proj: 'Barangaroo Tower 4', addr: '35 Barangaroo Avenue', suburb: 'Barangaroo', type: 'Commercial', status: 'Planning', src: 'The Urban Developer', url: 'https://www.theurbandeveloper.com/articles/lendlease-barangaroo-tower-4', snippet: 'Lendlease confirms feasibility study underway for fourth tower at Barangaroo South precinct. No DA lodged yet.', confidence: 'Medium' },
  { dev: 'Dexus', proj: 'Macquarie Park Innovation Quarter', addr: '14 Giffnock Avenue', suburb: 'Macquarie Park', type: 'Commercial', status: 'Active', src: 'AFR Property', url: 'https://www.afr.com/property', snippet: 'Dexus seeks expressions of interest for $180M office precinct adjacent to Macquarie University. JLL appointed as agent.', confidence: 'Medium' },
];

leads.forEach(l => {
  insertLead.run(l.dev, l.proj || null, l.addr, l.suburb, l.type, l.status || null,
    l.src, l.url, l.snippet, l.confidence, 'Pending');
});

// ── Scraper sources ────────────────────────────────────────────────────────
const insertSource = db.prepare(`
  INSERT INTO scraper_sources (name, url, enabled, respect_robots, notes)
  VALUES (?, ?, ?, ?, ?)
`);

[
  { name: 'NSW Planning Portal',    url: 'https://www.planningportal.nsw.gov.au',  enabled: 1, robots: 1, notes: 'DA tracker — search by suburb or applicant' },
  { name: 'The Urban Developer',    url: 'https://www.theurbandeveloper.com',       enabled: 1, robots: 1, notes: 'Property news feed' },
  { name: 'City of Sydney DA Tracker', url: 'https://da.cityofsydney.nsw.gov.au', enabled: 1, robots: 1, notes: 'Council DA search portal' },
  { name: 'AFR Property',           url: 'https://www.afr.com/property',            enabled: 0, robots: 1, notes: 'Paywalled — manual review recommended' },
  { name: 'North Sydney Council DA', url: 'https://northsydney.nsw.gov.au/da',     enabled: 1, robots: 1, notes: '' },
  { name: 'Ryde Council DA Tracker',url: 'https://ryde.nsw.gov.au/council/da',     enabled: 1, robots: 1, notes: '' },
].forEach(s => insertSource.run(s.name, s.url, s.enabled, s.robots, s.notes));

  console.log('✓ Seed complete.');
  console.log(`  Developers: ${db.prepare('SELECT COUNT(*) AS n FROM developers').get().n}`);
  console.log(`  Projects:   ${db.prepare('SELECT COUNT(*) AS n FROM projects').get().n}`);
  console.log(`  Contacts:   ${db.prepare('SELECT COUNT(*) AS n FROM contacts').get().n}`);
  console.log(`  Intel:      ${db.prepare('SELECT COUNT(*) AS n FROM intel').get().n}`);
  console.log(`  Leads:      ${db.prepare('SELECT COUNT(*) AS n FROM scraped_leads').get().n}`);
}

// Run directly: node server/seed.js [--force]
if (require.main === module) {
  seed(process.argv.includes('--force'));
}

module.exports = seed;
