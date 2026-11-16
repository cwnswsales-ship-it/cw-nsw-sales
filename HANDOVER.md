# HANDOVER — C&W NSW Investment Sales Database

Read this first in a new session. It is the project's state as at **16 November 2026**.

---

## What this is

An Express + SQLite + vanilla-JS single-page app tracking NSW commercial
investment sales for Cushman & Wakefield.

| | |
|---|---|
| **Live URL** | `https://cw-nsw-sales-production-5149.up.railway.app` |
| **Host** | Railway, project `beneficial-appreciation`, service `cw-nsw-sales` |
| **Deploys from** | the `main` branch — pushing to a feature branch alone changes nothing |
| **Password** | `APP_PASSWORD` env var (default `CW@Investment2025` if unset) |
| **Object storage** | Tigris, endpoint `https://t3.storageapi.dev`, region `auto` |

```
server.js            the whole API, Excel builders, seed + startup fixups (~190KB)
db.js                schema and idempotent ALTER TABLE migrations
public/index.html    the entire SPA — markup, CSS and JS in one file (~350KB)
scrapers/            Stonebridge web scraper
scripts/             db-restore (prestart), check-inserts (npm test), export-all
seeds/sales_2026.json  559 sales — the committed baseline
exports/             full JSON data exports (see "Restoring the data")
```

---

## ⚠ Three open problems

### 1. The office cannot reach the site — UNRESOLVED, blocking
The C&W corporate network blocks `*.up.railway.app` (silent packet drop →
`ERR_TIMED_OUT`). Confirmed by the user on 20 Sep. **Nothing built since then has
been seen by them.**

**The fix is a custom domain** — filters categorise by hostname, so a real domain
passes. Railway → service → Settings → Networking → Custom Domain, then set the
CNAME at the registrar. A C&W subdomain is best (allowlisted by default); any
owned domain works. No code change needed. Changing hosts does *not* help on its
own: `*.vercel.app`, `*.fly.dev` and `*.onrender.com` sit in the same category.

### 2. Bucket backups failing — needs the user
`SignatureDoesNotMatch` from Tigris every 5 minutes. That error means the **access
key ID is valid but the secret does not match it** — an invalid ID returns
`InvalidAccessKeyId` instead. Most likely the two halves are from different key
generations. Fix: generate a fresh Tigris key and paste **both** halves into
Railway. Region `auto` is correct for Tigris — do not change it.

On failure the log now prints endpoint, region, bucket, key-ID prefix and secret
*length* (no secret value), which separates a bad secret from an SDK problem.

### 3. No persistent volume — data-loss risk
`hasPersistentDisk()` has been reporting false. Without a Railway volume at the
app's `DATA_DIR`, the SQLite file lives on an ephemeral filesystem and survives
redeploys **only** via the bucket backup — which is currently broken (see 2).
**Mount a volume at `/app/data`.** Until then, treat `seeds/sales_2026.json` plus
`exports/` as the real record.

---

## Restoring the data

```bash
node scripts/export-all.js                      # write exports/cw-nsw-sales-<date>.json
node scripts/export-all.js --import <file>      # load one back
```

The export holds every table with its column list, so an old file still imports
after new columns are added — unknown columns are ignored, not fatal. Import is
`INSERT OR REPLACE`, so it is safe to re-run.

**`exports/cw-nsw-sales-2026-11-16.json` is the baseline**: 559 sales, 4 campaigns,
3 portfolio listings, 21 deletions. It was taken from a local database seeded from
the committed seed with all startup fixups applied — **it is not a dump of live
production**. Anything entered through the UI since the last seed commit exists
only on Railway. Once the site is reachable again, export from there and commit it.

---

## How the data layer behaves — read before changing it

- **`seeds/sales_2026.json` is merged on every boot** with `INSERT OR IGNORE`
  plus blank-column back-fill. It can **add** rows and fill empty fields; it can
  **never** change a value that is already set.
- **So editing the seed does not update existing live rows.** Changing a non-blank
  column in production needs an **idempotent startup fixup** in `server.js` (search
  `[fixup]`). That is the only mechanism that reaches live data.
- **Fixups that must run once** use the `fixups_applied` marker table, so a later
  manual correction in the app is not undone on the next deploy.
- **`deletions` stops deleted rows returning** on the next seed merge. Scraped
  portfolio listings also suppress a **`portfolio_listing_key`**, because a re-scan
  would otherwise reinsert the same property under a fresh id.
- **`npm test`** runs `scripts/check-inserts.js`, which counts columns against
  placeholders in every static INSERT. This class of bug has bitten three times and
  presents as "the Save button does nothing". Run it before every commit.

---

## Conventions worth keeping

- **Blank means "not captured", never zero.** Outgoings and tenure are left empty
  rather than guessed; totals exclude blanks so a partial record cannot look
  complete.
- **Every average states its sample size.** An average of 3 sales and one of 90
  look identical on a bar chart otherwise.
- **Charts say what is missing** instead of drawing an empty axis.
- **Income implies tenanted** — enter a rent and tenure locks to Tenanted. The rule
  lives server-side in `normaliseParties`, not only in the form, so imports obey it.
- **Brand**: C&W red `#ed1c24`, navy `#221c4e`. Deliberate exception — red is not
  used for financial figures, where it reads as a loss.

---

## Verifying changes

There is no test suite beyond `npm test`. Everything else is checked by driving a
real browser:

```bash
PORT=3999 node server.js &
NODE_PATH=/home/user/cw-nsw-sales/node_modules node <script>.js   # playwright-core
# chromium at /opt/pw-browsers/chromium-1194/chrome-linux/chrome
```

**Sandbox limits to know about:**
- Chart.js loads from a CDN the sandbox blocks → stub `window.Chart` to capture
  chart configs and assert on the data instead of the pixels.
- `railway.app`, `t3.storageapi.dev` and `stonebridge.com.au` are all blocked by the
  egress proxy. The Stonebridge scraper has an `SB_FIXTURE` env hook to exercise the
  whole pipeline offline.
- `node_modules` gets wiped by sandbox resets — `npm install` again.
- The sandbox has `python3`, `make` and `g++`, so native modules compile here that
  **fail in `node:20-slim`**. A Dockerfile change must be tested by building the
  image, not by running `npm install` locally. (This caused a build outage: bumping
  to `node:22-slim` broke `better-sqlite3@9.x`, which ships no Node 22 prebuild.
  Moving to Node 22 needs `better-sqlite3` v11+ first.)

---

## Data judgements left open

- **63-67 The Corso, Manly** — team records $9.9m; public records show a $12.5m
  Colliers backpacker sale. Flagged in notes, not overwritten.
- **30 Middle Street** — recorded as a settled $4m sale; a conflicting $5.86m
  "under contract" report from C&W Valuation & Advisory sits in its notes.
- **~40 records classed plainly "Commercial"** lack the detail to reclassify.
- **459 of 559 sales have no tenure** (no income, no VP marker) — deliberately
  blank, not an error.
- **No sale has outgoings or a listing date yet** — both field sets are new, so the
  outgoings and days-on-market charts are empty until data is entered.

---

## Recent work (newest first)

| Commit | What |
|---|---|
| `e569156` | Commit the lockfile — builds were resolving deps fresh each time |
| `0fa446f` | Revert to `node:20-slim` (the bump broke the build) |
| `b43f865` | Report every signing input when a backup signature fails |
| `6ae9a6e` | Stop a failing background job killing the server (crash guards) |
| `3f877b2` | Analytics: period + suburb filters, 4 new charts; itemised OPEX |
| `286906c` | Outgoings: statutory + OPEX |
| `2cb1378` | Development: approved DA details |
| `38f0391` | Tenure (tenanted / VP) and Capital Value |
| `1f99f35` | Tracked Stonebridge listings move out to Campaigns |
| `9b4014c` | Stonebridge Portfolio tracker, scanned from the web |

**Never verified in production** (the site has been unreachable): the Stonebridge
live scrape, document auto-extraction of the new outgoings/DA fields, and whether
the four new analytics charts actually render.

---

## Starting a new session

1. Clone the repo and read this file.
2. `npm install`
3. `node scripts/export-all.js --import exports/cw-nsw-sales-2026-11-16.json` if the
   database is empty and you want the baseline without a full seed boot.
4. `npm test` before committing anything.
5. Push to `main` — a feature branch alone does not deploy.
