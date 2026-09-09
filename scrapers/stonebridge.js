'use strict';
// Stonebridge Property Group — NSW premium investment opportunities.
//
// The CBRE tracker is fed by a PDF the user uploads. This one is fed by the web:
// we pull Stonebridge's public "for sale" indexes, follow through to the
// individual listing pages, and let Claude turn the page text into the same
// shape the portfolio table already renders. Runs monthly (and on demand).
//
// Note on environments: outbound access to stonebridge.com.au is blocked from
// the development sandbox, so this code path is exercised in production only.
// Everything except the fetch itself is unit-testable via scrapeFromPages().

const LIST_URLS = [
  'https://stonebridge.com.au/listings/for-sale/',
  'https://stonebridge.com.au/listings/for-sale/childcare-healthcare/',
  'https://stonebridge.com.au/listings/for-sale/fast-food-convenience-retail/',
  'https://stonebridge.com.au/listings/for-sale/retail/',
  'https://stonebridge.com.au/listings/for-sale/medical/',
  'https://stonebridge.com.au/for-sale/',
  'https://stonebridge.com.au/portfolio/',
];

const UA = 'Mozilla/5.0 (compatible; CW-NSW-SalesIntelligence/1.0; +portfolio-tracking)';
const FETCH_TIMEOUT_MS = 20000;
const MAX_LISTING_PAGES = 40;      // cap the crawl so one run can't sprawl
const MAX_CHARS_PER_PAGE = 12000;  // plenty for a listing page once stripped

async function fetchText(url) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// Strip a page to readable text. Deliberately crude — Claude does the parsing,
// this just removes the noise that would otherwise eat the token budget.
function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|li|tr|h[1-6]|section)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&#8217;|&rsquo;/gi, "'").replace(/&quot;/gi, '"')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

// Pull individual listing URLs out of an index page.
function extractListingLinks(html, baseUrl) {
  const out = new Set();
  const re = /href\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html))) {
    let href = m[1];
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
    try {
      const abs = new URL(href, baseUrl);
      if (!/stonebridge\.com\.au$/i.test(abs.hostname.replace(/^www\./, ''))) continue;
      // Listing detail pages live under /listing/<slug>/
      if (/\/listing\/[^/]+\/?$/i.test(abs.pathname)) out.add(abs.origin + abs.pathname);
    } catch (e) { /* ignore malformed href */ }
  }
  return [...out];
}

const EXTRACT_PROMPT = `You are reading the public web pages of Stonebridge Property Group, an Australian commercial real estate agency, to build a tracker of their CURRENT NSW investment opportunities.

Return a JSON array. One object per property that is FOR SALE (or currently being marketed) and located in NEW SOUTH WALES. Ignore properties in other states, ignore sold/past results, ignore blog posts and general marketing pages.

Each object uses exactly these keys (use null when the page does not say — never guess a number):
{
  "tenant": "the tenant or trading name, e.g. Guzman y Gomez, Goodstart Early Learning",
  "address": "street address",
  "suburb": "suburb only, no state or postcode",
  "state": "NSW",
  "asset_class": "one of: Childcare, Fast Food/QSR, Service Station, Supermarket, Convenience Retail, Healthcare, Medical, Retail, Office, Industrial, Pub/Hotel, Fitness, Cinema, Other",
  "net_rent": net income per annum as a NUMBER, no currency symbol or commas,
  "price_guide": guide/asking price as a NUMBER,
  "yield_percent": yield as a NUMBER e.g. 5.25,
  "wale": weighted average lease expiry in YEARS as a NUMBER,
  "land_area": site area in square metres as a NUMBER,
  "floor_area": building area in square metres as a NUMBER,
  "auction_date": "YYYY-MM-DD of the auction or EOI close, or null",
  "auction_location": "venue, or the sale method e.g. 'Expressions of Interest'",
  "campaign": "the portfolio/campaign name if stated, e.g. 'September National Portfolio'",
  "agent1": "primary agent's full name",
  "agent2": "second agent's full name",
  "source_url": "the URL of the page this property came from",
  "notes": "lease terms, options, car parking, zoning, tenure — anything a buyer's analyst would want. Keep under 300 characters."
}

Rules:
- NSW only. If the state is unclear, leave it out rather than guessing.
- Numbers must be plain numbers. "$331,950 pa" becomes 331950. "5.25%" becomes 5.25.
- "15 year lease" means wale 15 only if there is no separate WALE stated.
- If the same property appears on more than one page, return it once, with the fullest detail.
- If you find no NSW properties for sale, return [].
Return ONLY the JSON array, no prose, no markdown fence.`;

// Ask Claude to turn page text into structured listings.
async function extractListings(anthropic, pages) {
  const body = pages
    .map(p => `--- PAGE: ${p.url} ---\n${p.text.slice(0, MAX_CHARS_PER_PAGE)}`)
    .join('\n\n');

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    messages: [{ role: 'user', content: `${EXTRACT_PROMPT}\n\n${body}` }],
  });
  const text = (message.content[0]?.text || '').trim();
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('Claude returned no JSON array. Got: ' + text.slice(0, 200));
  const parsed = JSON.parse(match[0]);
  if (!Array.isArray(parsed)) throw new Error('Expected a JSON array of listings.');
  return parsed;
}

// Stable identity for a listing so a re-scan updates rather than duplicates.
// Street number + street name + suburb: survives the marketing headline changing.
function listingKey(l) {
  const addr = String(l.address || '').toLowerCase()
    .replace(/[.,]/g, ' ')
    .replace(/\b(unit|shop|suite|lot|tenancy)\b/g, ' ')
    .replace(/\b(street|st|road|rd|avenue|ave|parade|pde|drive|dr|highway|hwy|place|pl|court|ct|crescent|cres|boulevarde?|blvd|way|lane|ln|terrace|tce)\b/g, m => m[0])
    .replace(/\s+/g, ' ').trim();
  const suburb = String(l.suburb || '').toLowerCase().trim();
  const tenant = String(l.tenant || '').toLowerCase().trim();
  return `${addr}|${suburb}` === '|' ? tenant : `${addr}|${suburb}`;
}

// Normalise anything Claude may have returned as a string with symbols.
function num(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const n = parseFloat(String(v).replace(/[$,%\s,]/g, '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function normalise(l, fallbackUrl) {
  return {
    tenant: l.tenant || null,
    address: l.address || null,
    suburb: l.suburb ? String(l.suburb).replace(/\s*\([^)]*\)\s*$/, '').trim() : null,
    state: (l.state || 'NSW').toUpperCase(),
    asset_class: l.asset_class || null,
    net_rent: num(l.net_rent),
    price_guide: num(l.price_guide),
    yield_percent: num(l.yield_percent),
    wale: num(l.wale),
    land_area: num(l.land_area),
    floor_area: num(l.floor_area),
    auction_date: l.auction_date || null,
    auction_location: l.auction_location || null,
    campaign: l.campaign || null,
    agent1: l.agent1 || null,
    agent2: l.agent2 || null,
    source_url: l.source_url || fallbackUrl || null,
    notes: l.notes ? String(l.notes).slice(0, 400) : null,
  };
}

// Core, testable path: given already-fetched pages, produce clean NSW listings.
async function scrapeFromPages(anthropic, pages) {
  if (!pages.length) return [];
  const raw = await extractListings(anthropic, pages);
  const seen = new Map();
  for (const l of raw) {
    const n = normalise(l, pages[0].url);
    if (n.state !== 'NSW') continue;              // NSW only, as asked
    if (!n.address && !n.tenant) continue;        // nothing to identify it by
    const key = listingKey(n);
    if (!key || key === '|') continue;
    // Keep the richer record when the same property appears twice
    const prev = seen.get(key);
    const score = o => Object.values(o).filter(v => v !== null && v !== '').length;
    if (!prev || score(n) > score(prev)) seen.set(key, n);
  }
  return [...seen.entries()].map(([key, l]) => ({ ...l, listing_key: key }));
}

// Full path: crawl the public site, then extract.
async function scrape(anthropic, { log = () => {} } = {}) {
  // Test hook: point SB_FIXTURE at a JSON file of [{url,text},…] to exercise the
  // whole pipeline without network access (the dev sandbox cannot reach the site).
  if (process.env.SB_FIXTURE) {
    const fixture = JSON.parse(require('fs').readFileSync(process.env.SB_FIXTURE, 'utf8'));
    log(`using fixture ${process.env.SB_FIXTURE} (${fixture.length} pages)`);
    return { listings: await scrapeFromPages(anthropic, fixture), pagesFetched: fixture.length, failures: [] };
  }

  const pages = [];
  const listingUrls = new Set();
  const failures = [];

  for (const url of LIST_URLS) {
    try {
      const html = await fetchText(url);
      extractListingLinks(html, url).forEach(u => listingUrls.add(u));
      pages.push({ url, text: htmlToText(html) });
      log(`index ok: ${url}`);
    } catch (e) {
      failures.push(`${url}: ${e.message}`);
      log(`index failed: ${url} — ${e.message}`);
    }
  }

  const detailUrls = [...listingUrls].slice(0, MAX_LISTING_PAGES);
  for (const url of detailUrls) {
    try {
      pages.push({ url, text: htmlToText(await fetchText(url)) });
    } catch (e) {
      failures.push(`${url}: ${e.message}`);
    }
  }
  log(`fetched ${pages.length} pages (${detailUrls.length} listings), ${failures.length} failures`);

  if (!pages.length) {
    const err = new Error(
      'Could not reach stonebridge.com.au. ' +
      (failures[0] ? 'First error: ' + failures[0] : 'No pages fetched.')
    );
    err.unreachable = true;
    throw err;
  }

  const listings = await scrapeFromPages(anthropic, pages);
  return { listings, pagesFetched: pages.length, failures };
}

module.exports = {
  scrape, scrapeFromPages, listingKey, htmlToText, extractListingLinks, normalise, LIST_URLS,
};
