'use strict';

const axios = require('axios');
const cheerio = require('cheerio');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-AU,en;q=0.9',
};

const REGION_MAP = {
  // Eastern Suburbs
  'bondi': 'Eastern Suburbs', 'coogee': 'Eastern Suburbs', 'maroubra': 'Eastern Suburbs',
  'randwick': 'Eastern Suburbs', 'kingsford': 'Eastern Suburbs', 'kensington': 'Eastern Suburbs',
  'bronte': 'Eastern Suburbs', 'clovelly': 'Eastern Suburbs', 'waverley': 'Eastern Suburbs',
  'paddington': 'Eastern Suburbs', 'woollahra': 'Eastern Suburbs', 'double bay': 'Eastern Suburbs',
  'edgecliff': 'Eastern Suburbs', 'rose bay': 'Eastern Suburbs', 'vaucluse': 'Eastern Suburbs',
  'darlinghurst': 'Eastern Suburbs', 'surry hills': 'Eastern Suburbs', 'redfern': 'Eastern Suburbs',
  'waterloo': 'Eastern Suburbs', 'zetland': 'Eastern Suburbs', 'moore park': 'Eastern Suburbs',
  // CBD / City
  'sydney': 'CBD/City', 'haymarket': 'CBD/City', 'pyrmont': 'CBD/City',
  'ultimo': 'CBD/City', 'chippendale': 'CBD/City', 'the rocks': 'CBD/City',
  'barangaroo': 'CBD/City', 'millers point': 'CBD/City', 'dawes point': 'CBD/City',
  'glebe': 'Inner West', 'forest lodge': 'Inner West',
  // Inner West
  'newtown': 'Inner West', 'marrickville': 'Inner West', 'leichhardt': 'Inner West',
  'annandale': 'Inner West', 'balmain': 'Inner West', 'rozelle': 'Inner West',
  'petersham': 'Inner West', 'stanmore': 'Inner West', 'tempe': 'Inner West',
  'dulwich hill': 'Inner West', 'ashfield': 'Inner West', 'burwood': 'Inner West',
  'strathfield': 'Inner West', 'homebush': 'Inner West', 'concord': 'Inner West',
  // North Shore
  'north sydney': 'North Shore', 'crows nest': 'North Shore', 'st leonards': 'North Shore',
  'artarmon': 'North Shore', 'chatswood': 'North Shore', 'willoughby': 'North Shore',
  'lane cove': 'North Shore', 'gordon': 'North Shore', 'pymble': 'North Shore',
  'turramurra': 'North Shore', 'killara': 'North Shore', 'lindfield': 'North Shore',
  'roseville': 'North Shore', 'hornsby': 'North Shore', 'wahroonga': 'North Shore',
  // Northern Beaches
  'manly': 'Northern Beaches', 'dee why': 'Northern Beaches', 'brookvale': 'Northern Beaches',
  'collaroy': 'Northern Beaches', 'narrabeen': 'Northern Beaches', 'mona vale': 'Northern Beaches',
  'newport': 'Northern Beaches', 'avalon': 'Northern Beaches', 'palm beach': 'Northern Beaches',
  // Western Sydney
  'parramatta': 'Western Sydney', 'westmead': 'Western Sydney', 'penrith': 'Western Sydney',
  'blacktown': 'Western Sydney', 'seven hills': 'Western Sydney', 'baulkham hills': 'Western Sydney',
  'st marys': 'Western Sydney', 'mount druitt': 'Western Sydney', 'rooty hill': 'Western Sydney',
  'auburn': 'Western Sydney', 'merrylands': 'Western Sydney', 'granville': 'Western Sydney',
  'bankstown': 'Western Sydney', 'lidcombe': 'Western Sydney', 'rhodes': 'Western Sydney',
  // Hills District
  'west pennant hills': 'Hills District', 'pennant hills': 'Hills District',
  'castle hill': 'Hills District', 'kellyville': 'Hills District', 'rouse hill': 'Hills District',
  'norwest': 'Hills District', 'bella vista': 'Hills District', 'cherrybrook': 'Hills District',
  // Southern Sydney
  'hurstville': 'Southern Sydney', 'kogarah': 'Southern Sydney', 'rockdale': 'Southern Sydney',
  'bexley': 'Southern Sydney', 'allawah': 'Southern Sydney', 'penshurst': 'Southern Sydney',
  'mortdale': 'Southern Sydney', 'oatley': 'Southern Sydney', 'beverly hills': 'Southern Sydney',
  'sutherland': 'Southern Sydney', 'cronulla': 'Southern Sydney', 'miranda': 'Southern Sydney',
  'caringbah': 'Southern Sydney', 'taren point': 'Southern Sydney',
  // South West Sydney
  'liverpool': 'South West Sydney', 'campbelltown': 'South West Sydney',
  'fairfield': 'South West Sydney', 'cabramatta': 'South West Sydney',
  'liverpool': 'South West Sydney', 'prestons': 'South West Sydney',
  'ingleburn': 'South West Sydney', 'minto': 'South West Sydney',
};

const ASSET_KEYWORDS = {
  'Childcare': ['childcare', 'child care', 'early learning', 'kindergarten', 'preschool', 'daycare', 'day care', 'early childhood'],
  'Medical/Healthcare': ['medical', 'healthcare', 'health care', 'pharmacy', 'dental', 'doctor', 'clinic', 'hospital', 'specialist'],
  'Fast Food/QSR': ['mcdonald', 'kfc', 'hungry jack', 'subway', 'domino', 'red rooster', 'oporto', 'fast food', 'qsr'],
  'Service Station': ['service station', 'petrol', '7-eleven', 'ampol', 'bp ', 'caltex', 'shell', 'puma energy'],
  'Industrial': ['industrial', 'warehouse', 'logistics', 'factory', 'manufacturing', 'distribution'],
  'Pub/Hotel': ['hotel', 'pub ', 'tavern', 'inn ', 'motel', 'accommodation'],
  'Retail': ['retail', 'shop', 'shopping centre', 'supermarket', 'woolworths', 'coles', 'aldi'],
  'Development Site': ['development site', 'vacant land', 'da approved', 'zoned for', 'development opportunity'],
  'Commercial Office': ['office', 'commercial building', 'strata office'],
};

function classifyAsset(text) {
  const lower = (text || '').toLowerCase();
  for (const [cls, keywords] of Object.entries(ASSET_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) return cls;
  }
  return 'Commercial';
}

function inferRegion(suburb) {
  if (!suburb) return null;
  return REGION_MAP[suburb.toLowerCase().trim()] || null;
}

function isDuplicate(address, sourceUrl) {
  if (sourceUrl) {
    const byUrl = db.prepare('SELECT id FROM discoveries WHERE source_url = ?').get(sourceUrl);
    if (byUrl) return true;
    const inTracking = db.prepare('SELECT id FROM tracking WHERE source_url = ?').get(sourceUrl);
    if (inTracking) return true;
  }
  if (address) {
    const byAddr = db.prepare("SELECT id FROM discoveries WHERE address = ? AND status != 'dismissed'").get(address);
    if (byAddr) return true;
    const inTracking = db.prepare('SELECT id FROM tracking WHERE address = ?').get(address);
    if (inTracking) return true;
    const inSales = db.prepare('SELECT id FROM sales WHERE address = ?').get(address);
    if (inSales) return true;
  }
  return false;
}

const insertDiscovery = db.prepare(`
  INSERT INTO discoveries (id, address, suburb, region, asset_class, price_guide, description, agent, firm, source, source_url)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const logScrape = db.prepare(`
  INSERT INTO scrape_log (source, status, found, added, error) VALUES (?, ?, ?, ?, ?)
`);

async function fetchPage(url) {
  const resp = await axios.get(url, { headers: HEADERS, timeout: 15000 });
  return cheerio.load(resp.data);
}

// ── Burgess Rawson ──────────────────────────────────────────────────────────
async function scrapeBurgessRawson() {
  const source = 'Burgess Rawson';
  let found = 0, added = 0;
  try {
    const $ = await fetchPage('https://burgessrawson.com.au/campaigns/');
    const listings = [];

    // Try JSON-LD first
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).html());
        const items = Array.isArray(data) ? data : [data];
        items.forEach(item => {
          if (item['@type'] === 'Product' || item['@type'] === 'Offer' || item.name) {
            listings.push({
              address: item.name || item.address?.streetAddress,
              suburb: item.address?.addressLocality,
              description: item.description,
              url: item.url || item['@id'],
            });
          }
        });
      } catch {}
    });

    // HTML fallback
    if (listings.length === 0) {
      $('a[href*="/campaigns/"]').each((_, el) => {
        const href = $(el).attr('href');
        const text = $(el).closest('[class*="card"], [class*="listing"], article').text().trim();
        if (href && href !== '/campaigns/' && text.length > 20) {
          const fullUrl = href.startsWith('http') ? href : `https://burgessrawson.com.au${href}`;
          listings.push({ address: text.substring(0, 80), url: fullUrl, description: text });
        }
      });
    }

    for (const item of listings.slice(0, 30)) {
      found++;
      const addr = (item.address || '').trim();
      const suburb = item.suburb || extractSuburb(addr);
      if (!addr || isDuplicate(addr, item.url)) continue;
      const assetClass = classifyAsset(item.description || addr);
      const priceGuide = extractPriceGuide(item.description || '');
      insertDiscovery.run(uuidv4(), addr, suburb, inferRegion(suburb), assetClass, priceGuide, (item.description || '').substring(0, 500), null, 'Burgess Rawson', source, item.url || null);
      added++;
    }
    logScrape.run(source, 'ok', found, added, null);
  } catch (err) {
    logScrape.run(source, 'error', found, added, err.message);
  }
  return { source, found, added };
}

// ── CommercialRealEstate.com.au ─────────────────────────────────────────────
async function scrapeCommercialRealEstate() {
  const source = 'CommercialRealEstate';
  let found = 0, added = 0;
  const searchUrls = [
    'https://www.commercialrealestate.com.au/for-sale/investment/?state=nsw&propertyType=investment',
    'https://www.commercialrealestate.com.au/for-sale/?state=nsw&propertyType=childcare',
    'https://www.commercialrealestate.com.au/for-sale/?state=nsw&propertyType=medical',
  ];

  for (const url of searchUrls) {
    try {
      const $ = await fetchPage(url);
      // Try __NEXT_DATA__ JSON
      let parsed = false;
      $('script#__NEXT_DATA__').each((_, el) => {
        try {
          const data = JSON.parse($(el).html());
          const listings = data?.props?.pageProps?.listings || data?.props?.pageProps?.results || [];
          if (listings.length) {
            parsed = true;
            listings.forEach(listing => {
              found++;
              const addr = listing.address?.display || listing.displayAddress || '';
              const suburb = listing.address?.suburb || listing.suburb || extractSuburb(addr);
              if (!addr || isDuplicate(addr, listing.url || listing.id)) return;
              const desc = listing.description || listing.summary || '';
              const assetClass = classifyAsset(desc + ' ' + addr);
              const price = listing.price?.display || listing.priceDisplay || '';
              const agent = listing.agents?.[0]?.name || listing.agentName || '';
              const firm = listing.agents?.[0]?.agencyName || listing.agency?.name || 'CommercialRealEstate';
              const listingUrl = listing.url ? `https://www.commercialrealestate.com.au${listing.url}` : url;
              insertDiscovery.run(uuidv4(), addr, suburb, inferRegion(suburb), assetClass, price, desc.substring(0, 500), agent, firm, source, listingUrl);
              added++;
            });
          }
        } catch {}
      });

      if (!parsed) {
        // HTML fallback
        $('[data-testid*="listing"], .listing-card, [class*="ListingCard"]').each((_, el) => {
          found++;
          const addr = $(el).find('[data-testid*="address"], .address, [class*="address"]').first().text().trim();
          const price = $(el).find('[class*="price"], [data-testid*="price"]').first().text().trim();
          const agent = $(el).find('[class*="agent"]').first().text().trim();
          const linkEl = $(el).find('a').first();
          const href = linkEl.attr('href') || '';
          const listingUrl = href.startsWith('http') ? href : `https://www.commercialrealestate.com.au${href}`;
          if (!addr || isDuplicate(addr, listingUrl)) return;
          const suburb = extractSuburb(addr);
          const assetClass = classifyAsset(addr);
          insertDiscovery.run(uuidv4(), addr, suburb, inferRegion(suburb), assetClass, price, '', agent, 'CommercialRealEstate', source, listingUrl);
          added++;
        });
      }
    } catch (err) {
      logScrape.run(source + ':' + url.slice(-20), 'error', 0, 0, err.message);
    }
  }
  logScrape.run(source, 'ok', found, added, null);
  return { source, found, added };
}

// ── RealCommercial.com.au ───────────────────────────────────────────────────
async function scrapeRealCommercial() {
  const source = 'RealCommercial';
  let found = 0, added = 0;
  const searchUrls = [
    'https://www.realcommercial.com.au/for-sale/nsw/?propertyTypes=Investment',
    'https://www.realcommercial.com.au/for-sale/nsw/?propertyTypes=Childcare',
    'https://www.realcommercial.com.au/for-sale/nsw/?propertyTypes=Medical',
  ];

  for (const url of searchUrls) {
    try {
      const $ = await fetchPage(url);
      let parsed = false;

      // JSON data
      $('script').each((_, el) => {
        const content = $(el).html() || '';
        if (content.includes('"listings"') || content.includes('"results"')) {
          const match = content.match(/\{[^<]{200,}\}/);
          if (match) {
            try {
              const data = JSON.parse(match[0]);
              const listings = data.listings || data.results || [];
              if (listings.length) {
                parsed = true;
                listings.forEach(l => {
                  found++;
                  const addr = l.address || l.displayAddress || '';
                  const suburb = l.suburb || extractSuburb(addr);
                  const href = l.url || l.listingUrl || '';
                  const fullUrl = href.startsWith('http') ? href : `https://www.realcommercial.com.au${href}`;
                  if (!addr || isDuplicate(addr, fullUrl)) return;
                  const desc = l.description || l.headline || '';
                  const assetClass = classifyAsset(desc + ' ' + addr);
                  const price = l.price || l.priceDisplay || '';
                  const agent = l.agents?.[0]?.name || '';
                  const firm = l.agents?.[0]?.agencyName || 'RealCommercial';
                  insertDiscovery.run(uuidv4(), addr, suburb, inferRegion(suburb), assetClass, String(price), desc.substring(0, 500), agent, firm, source, fullUrl);
                  added++;
                });
              }
            } catch {}
          }
        }
      });

      if (!parsed) {
        $('[class*="listing"], [class*="Listing"], [data-testid*="listing"]').each((_, el) => {
          found++;
          const addr = $(el).find('[class*="address"], [class*="Address"]').first().text().trim();
          const price = $(el).find('[class*="price"], [class*="Price"]').first().text().trim();
          const href = $(el).find('a').first().attr('href') || '';
          const fullUrl = href.startsWith('http') ? href : `https://www.realcommercial.com.au${href}`;
          if (!addr || isDuplicate(addr, fullUrl)) return;
          const suburb = extractSuburb(addr);
          insertDiscovery.run(uuidv4(), addr, suburb, inferRegion(suburb), classifyAsset(addr), price, '', '', 'RealCommercial', source, fullUrl);
          added++;
        });
      }
    } catch (err) {
      logScrape.run(source + ':error', 'error', 0, 0, err.message);
    }
  }
  logScrape.run(source, 'ok', found, added, null);
  return { source, found, added };
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function extractSuburb(address) {
  if (!address) return null;
  // Typical format: "123 Street Name, Suburb NSW 2000"
  const parts = address.split(',');
  if (parts.length >= 2) {
    const lastParts = parts[parts.length - 1].trim().split(' ');
    // Remove state and postcode if present
    const suburb = lastParts.filter(p => !/^(NSW|VIC|QLD|SA|WA|TAS|ACT|NT|\d{4})$/.test(p)).join(' ').trim();
    if (suburb) return suburb;
    if (parts.length >= 2) {
      return parts[parts.length - 2].trim().split(' ').slice(-2).join(' ');
    }
  }
  return null;
}

function extractPriceGuide(text) {
  if (!text) return null;
  const match = text.match(/\$[\d,.]+(m|M|million|k|K|billion)?(\s*[-–]\s*\$[\d,.]+(m|M|million|k|K)?)?/);
  return match ? match[0] : null;
}

// ── Main Export ──────────────────────────────────────────────────────────────
async function runScraper() {
  console.log('[scraper] Starting scrape run...');
  const results = await Promise.allSettled([
    scrapeBurgessRawson(),
    scrapeCommercialRealEstate(),
    scrapeRealCommercial(),
  ]);
  const summary = results.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason?.message });
  console.log('[scraper] Done:', JSON.stringify(summary));
  return summary;
}

module.exports = { runScraper };
