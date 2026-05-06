'use strict';
const { db, syncDeveloperTags } = require('./db');

function seed(force) {
  const existing = db.prepare('SELECT COUNT(*) AS n FROM developers').get().n;
  if (existing > 0 && !force) {
    console.log('Database already seeded — skipping.');
    return;
  }

  console.log('Seeding database...');

  db.exec(`
    DELETE FROM intel; DELETE FROM contacts; DELETE FROM projects;
    DELETE FROM developer_tags; DELETE FROM developers;
    DELETE FROM scraped_leads; DELETE FROM scraper_sources;
    DELETE FROM users; DELETE FROM tags;
  `);

  // Tags
  const insertTag = db.prepare('INSERT INTO tags (name, colour) VALUES (?, ?)');
  [
    ['Active Pipeline',   '#1E6B45'],
    ['High Value',        '#1B2A4A'],
    ['Watch List',        '#D97706'],
    ['Foreign Developer', '#7C3AED'],
    ['Repeat Client',     '#1565C0'],
    ['New Contact',       '#6B7490'],
  ].forEach(([name, colour]) => insertTag.run(name, colour));

  // Users
  const insertUser = db.prepare('INSERT INTO users (name, email, role) VALUES (?, ?, ?)');
  [
    ['James Thorpe',   'j.thorpe@cushmanwakefield.com',   'Director'],
    ['Sarah Mitchell', 's.mitchell@cushmanwakefield.com', 'Senior Agent'],
    ['Ben Kavanaugh',  'b.kavanaugh@cushmanwakefield.com','Agent'],
    ['Priya Nair',     'p.nair@cushmanwakefield.com',     'Agent'],
  ].forEach(([name, email, role]) => insertUser.run(name, email, role));

  // Developers
  const insertDev = db.prepare(`
    INSERT INTO developers (name, abn, type, website, suburb, state, relationship_owner, notes)
    VALUES (?, ?, ?, ?, ?, 'NSW', ?, ?)
  `);
  const devData = [
    { name: 'Meriton Group',             abn: '44 000 000 001', type: 'Residential', web: 'https://www.meriton.com.au',                suburb: 'Mascot',        owner: 'James Thorpe',   notes: "Australia's largest apartment developer. Active across multiple Sydney precincts.", tags: ['Active Pipeline','High Value','Repeat Client'] },
    { name: 'Frasers Property Australia', abn: '44 000 000 002', type: 'Mixed',       web: 'https://www.fraserspropertyaustralia.com.au', suburb: 'Rhodes',       owner: 'Sarah Mitchell', notes: 'Listed developer with significant NSW pipeline. Strong relationship with ANZ.',     tags: ['Active Pipeline','High Value'] },
    { name: 'Aqualand',                  abn: '44 000 000 003', type: 'Residential', web: 'https://www.aqualand.com.au',               suburb: 'Milsons Point', owner: 'James Thorpe',   notes: 'Chinese-backed developer. Luxury residential focus. Key contacts in Sydney CBD.',  tags: ['Foreign Developer','High Value'] },
    { name: 'Coronation Property Group', abn: '44 000 000 004', type: 'Mixed',       web: 'https://www.coronation.com.au',             suburb: 'Pyrmont',       owner: 'Ben Kavanaugh',  notes: 'Strong activity in inner west. Interested in mixed-use and BTR opportunities.',    tags: ['Active Pipeline','Watch List'] },
    { name: 'Altis Property Partners',   abn: '44 000 000 005', type: 'Commercial',  web: 'https://www.altis.com.au',                  suburb: 'North Sydney',  owner: 'Priya Nair',     notes: 'Institutional fund manager. Office and industrial focus.',                         tags: ['High Value'] },
    { name: 'Urban Rest',                abn: '44 000 000 006', type: 'Residential', web: 'https://www.urbanrest.com.au',              suburb: 'Surry Hills',   owner: 'Ben Kavanaugh',  notes: 'BTR / serviced apartment operator. Growing portfolio across Eastern Seaboard.',    tags: ['New Contact','Watch List'] },
  ];
  const devIds = {};
  devData.forEach(d => {
    const r = insertDev.run(d.name, d.abn, d.type, d.web, d.suburb, d.owner, d.notes);
    devIds[d.name] = r.lastInsertRowid;
    syncDeveloperTags(r.lastInsertRowid, d.tags);
  });

  // Projects
  const insertProject = db.prepare(`
    INSERT INTO projects (developer_id, name, address, suburb, state, project_type, status,
      planning_status, estimated_value, lot_count, funder, valuer, sales_agent, notes)
    VALUES (?, ?, ?, ?, 'NSW', ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const projectData = [
    { dev: 'Meriton Group',             name: 'World Tower Residences – Stage 3', addr: '1 Market Street',      suburb: 'Sydney CBD',    type: 'Residential', status: 'Under Construction', planning: 'Construction Certificate', value: 420000000, lots: 340, funder: 'Westpac',              valuer: 'JLL',          agent: 'James Thorpe',   notes: 'Stage 3 tower, completion expected Q3 2026. Pre-sales 85% sold.' },
    { dev: 'Meriton Group',             name: 'Mascot Central',                   addr: '810 Botany Road',      suburb: 'Mascot',        type: 'Residential', status: 'Planning',           planning: 'DA Pending',              value: 180000000, lots: 210, funder: 'NAB',                  valuer: 'CBRE',         agent: 'James Thorpe',   notes: 'DA lodged Feb 2025. Awaiting Council response. 40-storey mixed tower.' },
    { dev: 'Frasers Property Australia', name: 'Central Park Rhodes',             addr: '1 Rider Boulevard',    suburb: 'Rhodes',        type: 'Mixed Use',   status: 'Active',             planning: 'DA Approved',             value: 650000000, lots: 520, funder: 'ANZ',                  valuer: 'Knight Frank', agent: 'Sarah Mitchell', notes: 'Masterplan approved. Retail podium and 4 residential towers. EOI launched.' },
    { dev: 'Aqualand',                  name: 'North Sydney Luxury Residences',   addr: '88 Walker Street',     suburb: 'North Sydney',  type: 'Residential', status: 'Under Construction', planning: 'Construction Certificate', value: 310000000, lots: 190, funder: 'China Construction Bank', valuer: 'Savills',      agent: 'James Thorpe',   notes: 'Premium product. Strong Asian buyer base. Expected settlement Q2 2026.' },
    { dev: 'Coronation Property Group', name: 'Pyrmont Peninsula – Block E',      addr: '21 Harris Street',     suburb: 'Pyrmont',       type: 'Mixed Use',   status: 'Planning',           planning: 'DA Pending',              value: 290000000, lots: 280, funder: 'Commonwealth Bank',     valuer: 'JLL',          agent: 'Ben Kavanaugh',  notes: 'Part of broader Pyrmont Peninsula precinct. Discussions with City of Sydney ongoing.' },
    { dev: 'Altis Property Partners',   name: 'Chatswood Office Campus',          addr: '67 Albert Avenue',     suburb: 'Chatswood',     type: 'Commercial',  status: 'Completed',          planning: 'Completed',               value: 220000000, lots: null, funder: 'Macquarie Bank',       valuer: 'Colliers',     agent: 'Priya Nair',     notes: 'A-grade office, 18,000sqm NLA. Fully leased. Potential divestment opportunity.' },
    { dev: 'Urban Rest',                name: 'Surry Hills BTR Tower',            addr: '349 Crown Street',     suburb: 'Surry Hills',   type: 'Residential', status: 'Planning',           planning: 'DA Pending',              value: 95000000,  lots: 120, funder: 'TBC',                  valuer: 'CBRE',         agent: 'Ben Kavanaugh',  notes: 'Build-to-rent concept. Operator pre-committed. Funding discussions underway.' },
  ];
  const projIds = {};
  projectData.forEach(p => {
    const r = insertProject.run(devIds[p.dev], p.name, p.addr, p.suburb, p.type, p.status, p.planning, p.value, p.lots, p.funder, p.valuer, p.agent, p.notes);
    projIds[p.name] = r.lastInsertRowid;
  });

  // Contacts
  const insertContact = db.prepare(`
    INSERT INTO contacts (developer_id, first_name, last_name, title, phone, email, linkedin_url,
      linkedin_status, last_contact_date, follow_up_date, source, notes, relationship_owner)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const d = n => new Date(Date.now() - n*864e5).toISOString().slice(0,10);
  const a = n => new Date(Date.now() + n*864e5).toISOString().slice(0,10);
  [
    { dev:'Meriton Group',             fn:'Harry',   ln:'Triguboff', title:'Chairman & Managing Director', ph:'+61 2 9287 0000', em:'h.triguboff@meriton.com.au',    li:'https://linkedin.com/in/harry-triguboff',    liS:'Current',          lc:d(14),  fu:a(30), src:'Direct',        own:'James Thorpe',   notes:'Founder. High-level relationship. Contact only for major transactions.' },
    { dev:'Meriton Group',             fn:'David',   ln:'Cremona',   title:'Development Director',         ph:'+61 2 9287 0100', em:'d.cremona@meriton.com.au',       li:'https://linkedin.com/in/david-cremona',      liS:'Current',          lc:d(7),   fu:a(14), src:'Direct',        own:'James Thorpe',   notes:'Day-to-day contact for development pipeline queries.' },
    { dev:'Frasers Property Australia',fn:'Peta',    ln:'Boyes',     title:'Development Manager',          ph:'+61 2 8823 8888', em:'p.boyes@frasersproperty.com',    li:'https://linkedin.com/in/peta-boyes',         liS:'Potential Update', lc:d(45),  fu:a(7),  src:'Referral',      own:'Sarah Mitchell', notes:'Moved from Mirvac early 2024. Confirm current role.' },
    { dev:'Frasers Property Australia',fn:'Anthony', ln:'Boyd',      title:'CEO',                          ph:'+61 2 8823 8800', em:'a.boyd@frasersproperty.com',     li:'https://linkedin.com/in/anthony-boyd-fpa',   liS:'Current',          lc:d(60),  fu:a(21), src:'Event',         own:'Sarah Mitchell', notes:'Met at UDIA lunch March 2025.' },
    { dev:'Aqualand',                  fn:'Jin',     ln:'Lin',       title:'Managing Director',            ph:'+61 2 8262 2888', em:'j.lin@aqualand.com.au',          li:'https://linkedin.com/in/jin-lin-aqualand',   liS:'Unchecked',        lc:d(30),  fu:a(10), src:'Direct',        own:'James Thorpe',   notes:'Key decision maker. Prefers email over phone.' },
    { dev:'Coronation Property Group', fn:'Joseph',  ln:'Nahas',     title:'Managing Director',            ph:'+61 2 8078 0000', em:'j.nahas@coronation.com.au',      li:'https://linkedin.com/in/joseph-nahas',       liS:'Current',          lc:d(21),  fu:a(5),  src:'Direct',        own:'Ben Kavanaugh',  notes:'Prefers breakfast meetings. Lives in Pyrmont.' },
    { dev:'Coronation Property Group', fn:'Tom',     ln:'Walker',    title:'Head of Acquisitions',         ph:null,              em:'t.walker@coronation.com.au',     li:null,                                         liS:'Unchecked',        lc:d(90),  fu:null,  src:'LinkedIn',      own:'Ben Kavanaugh',  notes:'Met at REINSW event. No phone on file.' },
    { dev:'Altis Property Partners',   fn:'Ken',     ln:'Morrison',  title:'Portfolio Manager',            ph:'+61 2 9231 0000', em:'k.morrison@altis.com.au',        li:'https://linkedin.com/in/ken-morrison-altis', liS:'Confirmed Changed',lc:d(120), fu:a(3),  src:'Referral',      own:'Priya Nair',     notes:'LinkedIn shows moved to BlackRock. Needs urgent verification.' },
    { dev:'Urban Rest',                fn:'Melissa', ln:'Caddick',   title:null,                           ph:'+61 412 000 000', em:null,                             li:'https://linkedin.com/in/melissa-caddick',    liS:'Unchecked',        lc:null,   fu:a(2),  src:'Cold Outreach', own:'Ben Kavanaugh',  notes:'Incomplete record. Follow up urgently.' },
  ].forEach(c => insertContact.run(devIds[c.dev], c.fn, c.ln, c.title, c.ph, c.em, c.li, c.liS, c.lc, c.fu, c.src, c.notes, c.own));

  // Intel
  const insertIntel = db.prepare(`
    INSERT INTO intel (project_id, developer_id, content, source, source_url, added_by, intel_date)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  [
    { proj:'World Tower Residences – Stage 3', dev:'Meriton Group',             content:'Site inspection confirmed crane erected. Concrete poured to level 14. On track for Q3 2026 completion.',                                source:'Internal',  url:null,                                        by:'James Thorpe',   date:d(3) },
    { proj:'World Tower Residences – Stage 3', dev:'Meriton Group',             content:'Pre-sales tracker updated: 289 of 340 units contracted (85%). Balance of 51 releasing at completion.',                                  source:'Internal',  url:null,                                        by:'James Thorpe',   date:d(10) },
    { proj:'Mascot Central',                   dev:'Meriton Group',             content:'Council requested additional traffic study. Submission lodged this week. Expect 4-6 week delay to DA determination.',                    source:'DA Portal', url:'https://da.cityofsydney.nsw.gov.au',        by:'Sarah Mitchell', date:d(5) },
    { proj:'Central Park Rhodes',              dev:'Frasers Property Australia', content:'EOI received from 6 qualified purchasers. Highest bid ~$290M for Lot 2A. Board review scheduled for next Thursday.',                   source:'Internal',  url:null,                                        by:'Sarah Mitchell', date:d(2) },
    { proj:'North Sydney Luxury Residences',   dev:'Aqualand',                  content:'Aqualand confirms Q2 2026 settlement date. Agent briefed 88 outstanding buyers. Expected settlement revenue ~$280M.',                   source:'Agent',     url:null,                                        by:'James Thorpe',   date:d(8) },
    { proj:'Pyrmont Peninsula – Block E',      dev:'Coronation Property Group', content:'City of Sydney advised informal pre-DA meeting scheduled for 22 May 2025. Positive signals on height envelope.',                        source:'Agent',     url:null,                                        by:'Ben Kavanaugh',  date:d(1) },
    { proj:'Surry Hills BTR Tower',            dev:'Urban Rest',                content:'Urban Developer article confirms Urban Rest seeking $95M in debt funding. Westpac and CBRE Capital Markets shortlisted.',               source:'Press',     url:'https://www.theurbandeveloper.com',          by:'Priya Nair',     date:d(4) },
  ].forEach(i => insertIntel.run(projIds[i.proj]||null, devIds[i.dev]||null, i.content, i.source, i.url, i.by, i.date));

  // Scraped leads
  const insertLead = db.prepare(`
    INSERT INTO scraped_leads (developer_name, project_name, address, suburb, project_type,
      status, source_name, source_url, raw_snippet, confidence, review_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')
  `);
  [
    { dev:'Stockland',         proj:'Waterloo Oval Redevelopment',      addr:'1 Waterloo Road',    suburb:'Waterloo',      type:'Mixed Use',  status:'Planning', src:'NSW Planning Portal',    url:'https://www.planningportal.nsw.gov.au',                   snippet:'DA lodged April 2025 for 42-storey mixed-use tower at Waterloo. Developer listed as Stockland Group. 380 residential lots plus ground-floor retail.',                    conf:'High' },
    { dev:'Mirvac',            proj:'Green Square Residences',          addr:'1 Joynton Avenue',   suburb:'Zetland',       type:'Residential',status:'Active',   src:'The Urban Developer',    url:'https://www.theurbandeveloper.com/articles/mirvac-green-square', snippet:'Mirvac launches sales for 240-apartment project in Green Square. $320M gross realisation expected.',                                                        conf:'High' },
    { dev:'Unknown Developer', proj:null,                               addr:'99 Mount Street',    suburb:'North Sydney',  type:'Commercial', status:null,       src:'Council DA Tracker',     url:'https://northsydney.nsw.gov.au/da',                       snippet:'DA 2025/0422 — demolition of existing commercial building and erection of 22-storey office tower. Developer applicant not disclosed.',                                conf:'Low'  },
    { dev:'Lendlease',         proj:'Barangaroo Tower 4',               addr:'35 Barangaroo Ave',  suburb:'Barangaroo',    type:'Commercial', status:'Planning', src:'The Urban Developer',    url:'https://www.theurbandeveloper.com/articles/lendlease-barangaroo-tower-4', snippet:'Lendlease confirms feasibility study underway for fourth tower at Barangaroo South precinct. No DA lodged yet.',                                              conf:'Medium'},
    { dev:'Dexus',             proj:'Macquarie Park Innovation Quarter',addr:'14 Giffnock Avenue', suburb:'Macquarie Park',type:'Commercial', status:'Active',   src:'AFR Property',           url:'https://www.afr.com/property',                            snippet:'Dexus seeks expressions of interest for $180M office precinct adjacent to Macquarie University. JLL appointed as agent.',                                       conf:'Medium'},
  ].forEach(l => insertLead.run(l.dev, l.proj||null, l.addr, l.suburb, l.type, l.status||null, l.src, l.url, l.snippet, l.conf));

  // Scraper sources
  const insertSource = db.prepare('INSERT INTO scraper_sources (name, url, enabled, respect_robots, notes) VALUES (?, ?, ?, 1, ?)');
  [
    ['NSW Planning Portal',       'https://www.planningportal.nsw.gov.au', 1, 'DA tracker — search by suburb or applicant'],
    ['The Urban Developer',       'https://www.theurbandeveloper.com',      1, 'Property news feed'],
    ['City of Sydney DA Tracker', 'https://da.cityofsydney.nsw.gov.au',    1, 'Council DA search portal'],
    ['AFR Property',              'https://www.afr.com/property',           0, 'Paywalled — manual review recommended'],
    ['North Sydney Council DA',   'https://northsydney.nsw.gov.au/da',     1, ''],
    ['Ryde Council DA Tracker',   'https://ryde.nsw.gov.au/council/da',    1, ''],
  ].forEach(([name, url, enabled, notes]) => insertSource.run(name, url, enabled, notes));

  console.log('✓ Seed complete —',
    db.prepare('SELECT COUNT(*) AS n FROM developers').get().n, 'developers,',
    db.prepare('SELECT COUNT(*) AS n FROM projects').get().n, 'projects,',
    db.prepare('SELECT COUNT(*) AS n FROM contacts').get().n, 'contacts'
  );
}

if (require.main === module) {
  seed(process.argv.includes('--force'));
}

module.exports = seed;
