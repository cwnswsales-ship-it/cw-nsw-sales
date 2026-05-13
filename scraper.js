'use strict';

const axios = require('axios');
const cheerio = require('cheerio');
const { gId } = require('./db');

// ─── Constants ─────────────────────────────────────────────────────────────

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-AU,en;q=0.9',
};

const TIMEOUT = 15000;

const PREMIUM_KEYWORDS = [
  'childcare', 'child care', 'fast food', 'medical', 'service station',
  'retail net lease', 'net lease', 'mcdonald', 'kfc', 'hungry jack',
  'subway', 'pharmacy', 'dental', 'gp clinic',
];

const REGION_MAP = {
  'Eastern Suburbs': [
    'bondi', 'randwick', 'maroubra', 'coogee', 'clovelly', 'bronte', 'tamarama',
    'surry hills', 'paddington', 'woollahra', 'double bay', 'rose bay', 'vaucluse',
    'edgecliff', 'darlinghurst', 'potts point', 'elizabeth bay', 'rushcutters bay',
    'kensington', 'kingsford', 'malabar', 'little bay', 'la perouse', 'matraville',
    'zetland', 'waterloo', 'redfern', 'beaconsfield', 'alexandria', 'newtown',
    'enmore', 'erskineville', 'st peters', 'tempe', 'sydenham',
  ],
  'Sydney CBD': [
    'sydney', 'haymarket', 'pyrmont', 'ultimo', 'chippendale', 'glebe',
    'millers point', 'the rocks', 'barangaroo', 'dawes point', 'woolloomooloo',
    'east sydney',
  ],
  'North Shore': [
    'mosman', 'neutral bay', 'cremorne', 'chatswood', 'st leonards', 'artarmon',
    'lane cove', 'north sydney', 'milsons point', 'waverton', 'wollstonecraft',
    'crows nest', 'cammeray', 'naremburn', 'willoughby', 'castle cove',
    'lindfield', 'killara', 'gordon', 'pymble', 'turramurra', 'wahroonga',
    'hornsby', 'ku-ring-gai', 'ryde', 'meadowbank', 'west ryde', 'epping',
    'macquarie park', 'north ryde', 'marsfield',
  ],
  'Western Sydney': [
    'parramatta', 'penrith', 'blacktown', 'seven hills', 'toongabbie',
    'westmead', 'wentworthville', 'merrylands', 'guildford', 'auburn',
    'lidcombe', 'berala', 'regents park', 'homebush', 'strathfield',
    'burwood', 'concord', 'rhodes', 'olympic park', 'campsie', 'bankstown',
    'yagoona', 'villawood', 'fairfield', 'cabramatta', 'liverpool',
    'mount druitt', 'st marys', 'west pennant hills', 'castle hill',
    'bella vista', 'norwest', 'baulkham hills', 'hills district',
    'kellyville', 'rouse hill', 'marsden park',
  ],
  'Southern Sydney': [
    'cronulla', 'rockdale', 'hurstville', 'kogarah', 'sans souci',
    'brighton-le-sands', 'monterey', 'arncliffe', 'wolli creek',
    'sydenham', 'tempe', 'mascot', 'botany', 'pagewood', 'eastgardens',
    'sutherland', 'miranda', 'caringbah', 'engadine', 'heathcote',
    'gymea', 'kirrawee', 'jannali', 'como', 'carss park',
  ],
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function classifyRegion(suburb) {
  if (!suburb) return 'Metro';
  const s = suburb.toLowerCase().trim();
  for (const [region, suburbs] of Object.entries(REGION_MAP)) {
    if (suburbs.some(k => s.includes(k))) return region;
  }
  return 'Metro';
}

function isPremium(classification) {
  if (!classification) return false;
  const c = classification.toLowerCase();
  return PREMIUM_KEYWORDS.some(kw => c.includes(kw));
}

function parsePrice(str) {
  if (!str) return null;
  const cleaned = str.replace(/[$,\s]/g, '').replace(/[mM]$/, match => match === 'm' || match === 'M' ? '000000' : '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function extractSuburb(address) {
  if (!address) return null;
  // Try to extract suburb from end of address "123 Smith St, Bondi NSW 2026"
  const m = address.match(/,\s*([A-Za-z\s]+?)(?:\s+NSW|\s+\d{4}|$)/i);
  return m ? m[1].trim() : null;
}

function httpGet(url) {
  return axios.get(url, { headers: HEADERS, timeout: TIMEOUT, maxRedirects: 5 });
}

// ─── Source scrapers ────────────────────────────────────────────────────────

/**
 * Scrape commercialrealestate.com.au
 * Tries __NEXT_DATA__ JSON first, falls back to HTML card parsing.
 */
async function scrapeCommercialRealEstate() {
  const results = [];
  const areas = [
    'eastern-suburbs', 'sydney-cbd', 'north-shore',
    'western-sydney', 'southern-sydney',
  ];

  for (const area of areas) {
    const url = `https://www.commercialrealestate.com.au/commercial-property/nsw/${area}/for-sale/`;
    try {
      const { data: html } = await httpGet(url);
      const $ = cheerio.load(html);

      // Try __NEXT_DATA__ JSON first
      const nextDataScript = $('#__NEXT_DATA__').html();
      if (nextDataScript) {
        try {
          const nextData = JSON.parse(nextDataScript);
          const listings =
            nextData?.props?.pageProps?.listings ||
            nextData?.props?.pageProps?.searchResults?.listings ||
            nextData?.props?.pageProps?.results ||
            [];

          for (const listing of listings) {
            const addr = listing.address || listing.propertyAddress?.fullAddress || '';
            const suburb = listing.suburb || listing.propertyAddress?.suburb || extractSuburb(addr);
            const classification = listing.propertyType || listing.type || 'Commercial';
            const priceStr = listing.price || listing.priceLabel || '';
            const netIncome = listing.annualIncome || listing.netIncome || null;
            const agent = listing.agentName || (listing.agents && listing.agents[0]?.name) || '';
            const listingUrl = listing.listingUrl || listing.url
              ? `https://www.commercialrealestate.com.au${listing.listingUrl || listing.url}`
              : url;

            if (!addr) continue;

            results.push({
              address: addr,
              suburb: suburb || '',
              region: classifyRegion(suburb),
              classification,
              price_guide: parsePrice(priceStr),
              net_income: netIncome,
              agent,
              process: 'For Sale',
              source_url: listingUrl,
              scrape_source: 'commercialrealestate.com.au',
              is_premium: isPremium(classification) ? 1 : 0,
            });
          }
          continue; // success, skip HTML fallback
        } catch (_e) {
          // fall through to HTML parsing
        }
      }

      // HTML card fallback
      $('[data-testid="listing-card"], .listing-card, article[class*="listing"], [class*="property-card"]').each((_, el) => {
        const card = $(el);
        const addr = card.find('[data-testid="listing-address"], [class*="address"], h2, h3').first().text().trim();
        const suburbRaw = card.find('[class*="suburb"], [data-testid="listing-suburb"]').first().text().trim();
        const classificationRaw = card.find('[class*="type"], [class*="property-type"]').first().text().trim();
        const priceRaw = card.find('[class*="price"], [data-testid="listing-price"]').first().text().trim();
        const agentRaw = card.find('[class*="agent"], [class*="agency"]').first().text().trim();
        const href = card.find('a[href]').first().attr('href') || '';
        const listingUrl = href.startsWith('http') ? href : `https://www.commercialrealestate.com.au${href}`;

        if (!addr) return;

        results.push({
          address: addr,
          suburb: suburbRaw || extractSuburb(addr) || '',
          region: classifyRegion(suburbRaw || extractSuburb(addr)),
          classification: classificationRaw || 'Commercial',
          price_guide: parsePrice(priceRaw),
          net_income: null,
          agent: agentRaw,
          process: 'For Sale',
          source_url: listingUrl,
          scrape_source: 'commercialrealestate.com.au',
          is_premium: isPremium(classificationRaw) ? 1 : 0,
        });
      });
    } catch (err) {
      // Per-area errors are acceptable — don't crash the whole source
      console.warn(`[scraper] CRE area ${area} failed: ${err.message}`);
    }
  }

  return results;
}

/**
 * Scrape realcommercial.com.au
 */
async function scrapeRealCommercial() {
  const results = [];
  const searches = [
    { suburb: 'sydney+nsw', region: 'Sydney CBD' },
    { suburb: 'eastern+suburbs+nsw', region: 'Eastern Suburbs' },
    { suburb: 'parramatta+nsw', region: 'Western Sydney' },
    { suburb: 'chatswood+nsw', region: 'North Shore' },
    { suburb: 'hurstville+nsw', region: 'Southern Sydney' },
  ];

  for (const { suburb, region } of searches) {
    const url = `https://www.realcommercial.com.au/for-sale/in-${suburb}/?propertyTypes=commercial`;
    try {
      const { data: html } = await httpGet(url);
      const $ = cheerio.load(html);

      // Try JSON-LD structured data first
      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const data = JSON.parse($(el).html());
          const items = Array.isArray(data) ? data : [data];
          for (const item of items) {
            if (item['@type'] === 'Product' || item['@type'] === 'Offer' || item.name) {
              results.push({
                address: item.name || item.address?.streetAddress || '',
                suburb: item.address?.addressLocality || '',
                region,
                classification: item.category || 'Commercial',
                price_guide: null,
                net_income: null,
                agent: item.seller?.name || '',
                process: 'For Sale',
                source_url: item.url || url,
                scrape_source: 'realcommercial.com.au',
                is_premium: 0,
              });
            }
          }
        } catch (_e) { /* ignore malformed JSON-LD */ }
      });

      // HTML card parsing
      $('[class*="listing-card"], [class*="property-card"], article').each((_, el) => {
        const card = $(el);
        const addr = card.find('[class*="address"], h2, h3').first().text().trim();
        const classificationRaw = card.find('[class*="type"], [class*="category"]').first().text().trim();
        const priceRaw = card.find('[class*="price"]').first().text().trim();
        const agentRaw = card.find('[class*="agent"], [class*="agency"]').first().text().trim();
        const href = card.find('a[href]').first().attr('href') || '';
        const listingUrl = href.startsWith('http') ? href : `https://www.realcommercial.com.au${href}`;

        if (!addr || addr.length < 5) return;

        results.push({
          address: addr,
          suburb: extractSuburb(addr) || '',
          region,
          classification: classificationRaw || 'Commercial',
          price_guide: parsePrice(priceRaw),
          net_income: null,
          agent: agentRaw,
          process: 'For Sale',
          source_url: listingUrl,
          scrape_source: 'realcommercial.com.au',
          is_premium: isPremium(classificationRaw) ? 1 : 0,
        });
      });
    } catch (err) {
      console.warn(`[scraper] RealCommercial ${suburb} failed: ${err.message}`);
    }
  }

  return results;
}

/**
 * Scrape Burgess Rawson campaigns
 */
async function scrapeBurgessRawson() {
  const results = [];
  const url = 'https://www.burgessrawson.com.au/properties';

  try {
    const { data: html } = await httpGet(url);
    const $ = cheerio.load(html);

    $('[class*="property"], [class*="listing"], [class*="campaign"], article').each((_, el) => {
      const card = $(el);

      const addr = card.find('[class*="address"], [class*="title"], h2, h3, h4').first().text().trim();
      const suburbRaw = card.find('[class*="suburb"], [class*="location"]').first().text().trim();
      const classificationRaw = card.find('[class*="type"], [class*="category"], [class*="asset"]').first().text().trim();
      const priceRaw = card.find('[class*="price"], [class*="guide"]').first().text().trim();
      const agentRaw = card.find('[class*="agent"], [class*="broker"]').first().text().trim();
      const closeDateRaw = card.find('[class*="close"], [class*="deadline"], [class*="date"]').first().text().trim();
      const href = card.find('a[href]').first().attr('href') || '';
      const listingUrl = href.startsWith('http') ? href
        : href ? `https://www.burgessrawson.com.au${href}`
        : url;

      if (!addr || addr.length < 5) return;

      const suburb = suburbRaw || extractSuburb(addr) || '';

      // Classify by NSW only — skip interstate listings heuristically
      // (no hard filter so we don't miss anything)
      const classification = classificationRaw || guessClassification(addr + ' ' + classificationRaw);

      results.push({
        address: addr,
        suburb,
        region: classifyRegion(suburb),
        classification,
        price_guide: parsePrice(priceRaw),
        net_income: null,
        agent: agentRaw || 'Burgess Rawson',
        process: 'EOI',
        close_date: closeDateRaw || null,
        source_url: listingUrl,
        scrape_source: 'burgessrawson.com.au',
        is_premium: isPremium(classification) ? 1 : 0,
      });
    });

    // Also try JSON-LD
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).html());
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          if (item['@type'] && item.name && item.address) {
            const suburb = item.address.addressLocality || '';
            const classification = item.additionalType || item.description?.split('\n')[0] || 'Investment';
            results.push({
              address: `${item.address.streetAddress || ''}, ${suburb}`,
              suburb,
              region: classifyRegion(suburb),
              classification,
              price_guide: null,
              net_income: null,
              agent: 'Burgess Rawson',
              process: 'EOI',
              source_url: item.url || url,
              scrape_source: 'burgessrawson.com.au',
              is_premium: isPremium(classification) ? 1 : 0,
            });
          }
        }
      } catch (_e) { /* ignore */ }
    });
  } catch (err) {
    console.warn(`[scraper] Burgess Rawson failed: ${err.message}`);
    return { results: [], error: err.message };
  }

  return { results, error: null };
}

/**
 * Scrape Stonebridge campaigns
 */
async function scrapeStonebridge() {
  const results = [];
  const url = 'https://www.stonebridge.com.au/campaigns';

  try {
    const { data: html } = await httpGet(url);
    const $ = cheerio.load(html);

    $('[class*="campaign"], [class*="property"], [class*="listing"], article').each((_, el) => {
      const card = $(el);

      const addr = card.find('[class*="address"], [class*="title"], [class*="street"], h2, h3, h4').first().text().trim();
      const suburbRaw = card.find('[class*="suburb"], [class*="location"], [class*="city"]').first().text().trim();
      const classificationRaw = card.find('[class*="type"], [class*="category"], [class*="asset-type"]').first().text().trim();
      const priceRaw = card.find('[class*="price"], [class*="guide"], [class*="asking"]').first().text().trim();
      const agentRaw = card.find('[class*="agent"], [class*="contact"]').first().text().trim();
      const closeDateRaw = card.find('[class*="close"], [class*="date"], [class*="deadline"]').first().text().trim();
      const href = card.find('a[href]').first().attr('href') || '';
      const listingUrl = href.startsWith('http') ? href
        : href ? `https://www.stonebridge.com.au${href}`
        : url;

      if (!addr || addr.length < 5) return;

      const suburb = suburbRaw || extractSuburb(addr) || '';
      const classification = classificationRaw || guessClassification(addr + ' ' + classificationRaw);

      results.push({
        address: addr,
        suburb,
        region: classifyRegion(suburb),
        classification,
        price_guide: parsePrice(priceRaw),
        net_income: null,
        agent: agentRaw || 'Stonebridge',
        process: 'EOI',
        close_date: closeDateRaw || null,
        source_url: listingUrl,
        scrape_source: 'stonebridge.com.au',
        is_premium: isPremium(classification) ? 1 : 0,
      });
    });
  } catch (err) {
    console.warn(`[scraper] Stonebridge failed: ${err.message}`);
    return { results: [], error: err.message };
  }

  return { results, error: null };
}

/**
 * Guess classification from text snippet
 */
function guessClassification(text) {
  if (!text) return 'Commercial';
  const t = text.toLowerCase();
  if (t.includes('childcare') || t.includes('child care')) return 'Childcare Centre';
  if (t.includes('fast food') || t.includes('mcdonald') || t.includes('kfc')) return 'Fast Food';
  if (t.includes('service station') || t.includes('petrol')) return 'Service Station';
  if (t.includes('medical') || t.includes('dental') || t.includes('pharmacy')) return 'Medical';
  if (t.includes('retail')) return 'Retail';
  if (t.includes('industrial')) return 'Industrial';
  if (t.includes('office')) return 'Office';
  if (t.includes('development')) return 'Development Site';
  if (t.includes('apartment') || t.includes('residential')) return 'Residential';
  return 'Commercial';
}

// ─── Duplicate check helpers ────────────────────────────────────────────────

function alreadyDiscovered(db, listing) {
  if (listing.source_url && listing.source_url.length > 10) {
    const row = db.prepare('SELECT id FROM discoveries WHERE source_url = ?').get(listing.source_url);
    if (row) return true;
  }
  if (listing.address && listing.suburb) {
    const row = db.prepare('SELECT id FROM discoveries WHERE address = ? AND suburb = ?')
      .get(listing.address, listing.suburb);
    if (row) return true;
  }
  return false;
}

function alreadyCampaign(db, listing) {
  if (!listing.address || !listing.suburb) return false;
  const row = db.prepare('SELECT id FROM campaigns WHERE address = ? AND suburb = ?')
    .get(listing.address, listing.suburb);
  return !!row;
}

// ─── Staleness checks for tracked campaigns ─────────────────────────────────

async function checkCampaignStaleness(db) {
  const activeCampaigns = db.prepare(
    `SELECT id, address, suburb, source_url FROM campaigns WHERE status = 'active' AND source_url IS NOT NULL AND source_url != ''`
  ).all();

  for (const campaign of activeCampaigns) {
    try {
      const resp = await axios.head(campaign.source_url, {
        headers: HEADERS,
        timeout: 10000,
        maxRedirects: 5,
        validateStatus: () => true,
      });

      const gone = resp.status === 404 || resp.status === 410;
      if (gone) {
        // Create an alert
        const alertId = gId();
        db.prepare(`
          INSERT INTO alerts (id, type, title, body, link_id, link_type, read, created_at)
          VALUES (?, 'stale', ?, ?, ?, 'campaign', 0, datetime('now'))
        `).run(
          alertId,
          `Listing may have sold: ${campaign.address}`,
          `The source URL for ${campaign.address}, ${campaign.suburb} returned ${resp.status}. The campaign may have transacted.`,
          campaign.id
        );

        db.prepare(`UPDATE campaigns SET last_checked = datetime('now') WHERE id = ?`).run(campaign.id);
      }
    } catch (_err) {
      // Network errors during head checks are non-fatal
    }
  }
}

// ─── Main export ────────────────────────────────────────────────────────────

async function runScraper(db) {
  const errors = [];
  let discovered = 0;

  const insertDiscovery = db.prepare(`
    INSERT OR IGNORE INTO discoveries
      (id, type, address, suburb, region, classification, price_guide, net_income,
       agent, process, close_date, source_url, scrape_source, raw_data, status, is_premium, created_at)
    VALUES
      (?, 'new', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, datetime('now'))
  `);

  const insertLog = db.prepare(`
    INSERT INTO scrape_log (source, status, found, errors, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `);

  async function processSource(name, scrapeFunc) {
    try {
      const raw = await scrapeFunc();
      // Support both array return and { results, error } return
      const listings = Array.isArray(raw) ? raw : (raw.results || []);
      const sourceError = Array.isArray(raw) ? null : raw.error;

      if (sourceError) errors.push(`${name}: ${sourceError}`);

      let found = 0;
      for (const listing of listings) {
        if (!listing.address || listing.address.length < 3) continue;
        if (alreadyDiscovered(db, listing)) continue;
        if (alreadyCampaign(db, listing)) continue;

        try {
          const id = gId();
          insertDiscovery.run(
            id,
            listing.address,
            listing.suburb || null,
            listing.region || null,
            listing.classification || null,
            listing.price_guide || null,
            listing.net_income || null,
            listing.agent || null,
            listing.process || null,
            listing.close_date || null,
            listing.source_url || null,
            listing.scrape_source || null,
            JSON.stringify(listing),
            listing.is_premium || 0
          );
          found++;
          discovered++;
        } catch (insertErr) {
          // Duplicate key or constraint — skip silently
          if (!insertErr.message.includes('UNIQUE')) {
            errors.push(`${name} insert: ${insertErr.message}`);
          }
        }
      }

      insertLog.run(name, 'ok', found, null);
      console.log(`[scraper] ${name}: found ${listings.length} listings, inserted ${found} new`);
    } catch (err) {
      const msg = err.message || String(err);
      errors.push(`${name}: ${msg}`);
      insertLog.run(name, 'error', 0, msg);
      console.error(`[scraper] ${name} failed: ${msg}`);
    }
  }

  await processSource('commercialrealestate.com.au', scrapeCommercialRealEstate);
  await processSource('realcommercial.com.au', scrapeRealCommercial);
  await processSource('burgessrawson.com.au', scrapeBurgessRawson);
  await processSource('stonebridge.com.au', scrapeStonebridge);

  // Check active campaigns for staleness (best-effort)
  try {
    await checkCampaignStaleness(db);
  } catch (err) {
    console.warn('[scraper] Staleness check failed:', err.message);
  }

  return { discovered, errors };
}

module.exports = { runScraper };
