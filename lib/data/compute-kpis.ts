import type { WIPRow, ListingRow, ForecastRow } from './types'

const DEAD_STATUSES = new Set(['Lost', 'Withdrawn'])

// ─── KPI totals ────────────────────────────────────────────────────────────

export interface KPIData {
  totalWIPValue: number
  totalWIPFee: number
  activeListingsValue: number
  activeListingsFee: number
  forecastFeesMonth: number
  forecastFeesQuarter: number
  settledFeesYTD: number
  activeSubmissions: number
  activeListingsCount: number
}

export function computeKPIs(
  wip: WIPRow[],
  listings: ListingRow[],
  forecast: ForecastRow[]
): KPIData {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()
  const currentQuarter = Math.floor(currentMonth / 3)

  // WIP — active pipeline only (exclude dead deals)
  const activePipeline = wip.filter(r => !DEAD_STATUSES.has(r.status))
  const totalWIPValue = activePipeline.reduce((s, r) => s + (r.value ?? 0), 0)
  const totalWIPFee = activePipeline.reduce((s, r) => s + (r.fee ?? 0), 0)
  const activeSubmissions = wip.filter(r => r.status === 'Submission').length

  // Active Listings
  const activeListingsValue = listings.reduce((s, r) => s + (r.price ?? 0), 0)
  const activeListingsFee = listings.reduce((s, r) => s + (r.fee ?? 0), 0)

  // Fee Forecast
  const settledFeesYTD = forecast
    .filter(r => r.status === 'Settled' && r.settlementDate?.getFullYear() === currentYear)
    .reduce((s, r) => s + (r.fee ?? 0), 0)

  const forecastFeesMonth = forecast
    .filter(r => {
      const d = r.settlementDate
      return d && d.getMonth() === currentMonth && d.getFullYear() === currentYear
    })
    .reduce((s, r) => s + (r.fee ?? 0), 0)

  const forecastFeesQuarter = forecast
    .filter(r => {
      const d = r.settlementDate
      return d && Math.floor(d.getMonth() / 3) === currentQuarter && d.getFullYear() === currentYear
    })
    .reduce((s, r) => s + (r.fee ?? 0), 0)

  return {
    totalWIPValue,
    totalWIPFee,
    activeListingsValue,
    activeListingsFee,
    forecastFeesMonth,
    forecastFeesQuarter,
    settledFeesYTD,
    activeSubmissions,
    activeListingsCount: listings.length,
  }
}

// ─── Chart datasets ─────────────────────────────────────────────────────────

export interface AgentFeeItem {
  agent: string
  settled: number
  forecast: number
  total: number
}

const AGENT_KEYS: { key: keyof ForecastRow; label: string }[] = [
  { key: 'mironSolomons', label: 'Miron S.' },
  { key: 'mattPontey', label: 'Matt P.' },
  { key: 'henryRobertson', label: 'Henry R.' },
  { key: 'jakeSmith', label: 'Jake S.' },
  { key: 'x', label: 'Other' },
]

export function computeAgentFeeData(forecast: ForecastRow[]): AgentFeeItem[] {
  return AGENT_KEYS.map(({ key, label }) => {
    let settled = 0
    let fc = 0
    for (const r of forecast) {
      const val = (r[key] as number | null) ?? 0
      if (r.status === 'Settled') settled += val
      else fc += val
    }
    return { agent: label, settled, forecast: fc, total: settled + fc }
  }).filter(d => d.total > 0)
}

export interface MonthFeeItem {
  month: string
  settled: number
  forecast: number
}

export function computeFeesByMonthData(forecast: ForecastRow[]): MonthFeeItem[] {
  const map = new Map<string, { settled: number; forecast: number; ts: number }>()

  for (const r of forecast) {
    if (!r.settlementDate || !r.fee) continue
    const d = r.settlementDate
    const key = d.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })
    const ts = new Date(d.getFullYear(), d.getMonth(), 1).getTime()
    const existing = map.get(key) ?? { settled: 0, forecast: 0, ts }
    if (r.status === 'Settled') existing.settled += r.fee
    else existing.forecast += r.fee
    map.set(key, existing)
  }

  return Array.from(map.entries())
    .sort(([, a], [, b]) => a.ts - b.ts)
    .map(([month, { settled, forecast }]) => ({ month, settled, forecast }))
}

export interface StatusItem {
  status: string
  count: number
  value: number
}

export function computeWIPByStatusData(wip: WIPRow[]): StatusItem[] {
  const map = new Map<string, { count: number; value: number }>()
  for (const r of wip) {
    const s = r.status || 'Unknown'
    const e = map.get(s) ?? { count: 0, value: 0 }
    e.count++
    e.value += r.value ?? 0
    map.set(s, e)
  }
  return Array.from(map.entries())
    .map(([status, v]) => ({ status, ...v }))
    .sort((a, b) => b.count - a.count)
}

export interface AssetClassItem {
  assetClass: string
  count: number
  value: number
}

export function computeListingsByAssetClassData(listings: ListingRow[]): AssetClassItem[] {
  const map = new Map<string, { count: number; value: number }>()
  for (const r of listings) {
    const ac = r.assetClass || 'Unknown'
    const e = map.get(ac) ?? { count: 0, value: 0 }
    e.count++
    e.value += r.price ?? 0
    map.set(ac, e)
  }
  return Array.from(map.entries())
    .map(([assetClass, v]) => ({ assetClass, ...v }))
    .sort((a, b) => b.count - a.count)
}

export interface RatingItem {
  rating: string
  count: number
  value: number
}

const RATING_SHORT: Record<string, string> = {
  'AAAA - Closed / Sold': 'AAAA',
  'AAA - Awarded / Won': 'AAA',
  'AA - Proposing / Sub': 'AA',
  'A - Validating': 'A',
  'Withdrawn / Lost': 'Lost',
}

export function computePipelineByRatingData(wip: WIPRow[]): RatingItem[] {
  const map = new Map<string, { count: number; value: number }>()
  for (const r of wip) {
    const rating = RATING_SHORT[r.rating] || r.rating || 'Unknown'
    const e = map.get(rating) ?? { count: 0, value: 0 }
    e.count++
    e.value += r.value ?? 0
    map.set(rating, e)
  }
  return Array.from(map.entries())
    .map(([rating, v]) => ({ rating, ...v }))
    .sort((a, b) => b.value - a.value)
}
