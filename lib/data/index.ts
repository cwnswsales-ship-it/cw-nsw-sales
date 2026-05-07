/**
 * Data adapter layer.
 *
 * This is the single import point for all data in the app.
 * - If `data/workbook.xlsx` exists at the project root it is read via the xlsx parsers.
 * - Otherwise the built-in mock data is returned.
 *
 * To connect a real spreadsheet: drop `workbook.xlsx` into the `/data` folder
 * and restart the dev server. The sheet names and column headers must match
 * (or close-enough — the parsers handle common variants).
 *
 * To swap to a different data source later (Google Sheets, SharePoint, Supabase)
 * replace the body of getWIP / getActiveListings / getFeeForecast without
 * touching the rest of the app.
 */

import path from 'path'
import fs from 'fs'
import { parseWIP, parseActiveListings, parseFeeForecast } from './parsers'
import { MOCK_WIP, MOCK_ACTIVE_LISTINGS, MOCK_FEE_FORECAST } from './mock'
import type { WIPRow, ActiveListingRow, FeeForecastRow, DashboardSummary, AgentSummary } from './types'

export type { WIPRow, ActiveListingRow, FeeForecastRow, DashboardSummary, AgentSummary }

// ─── Source detection ─────────────────────────────────────────────────────────

const WORKBOOK_PATH = path.join(process.cwd(), 'data', 'workbook.xlsx')

function workbookExists(): boolean {
  return fs.existsSync(WORKBOOK_PATH)
}

// ─── Data accessors ───────────────────────────────────────────────────────────

export async function getWIP(): Promise<WIPRow[]> {
  if (workbookExists()) return parseWIP(WORKBOOK_PATH)
  return MOCK_WIP
}

export async function getActiveListings(): Promise<ActiveListingRow[]> {
  if (workbookExists()) return parseActiveListings(WORKBOOK_PATH)
  return MOCK_ACTIVE_LISTINGS
}

export async function getFeeForecast(): Promise<FeeForecastRow[]> {
  if (workbookExists()) return parseFeeForecast(WORKBOOK_PATH)
  return MOCK_FEE_FORECAST
}

// ─── Dashboard summary ────────────────────────────────────────────────────────

function isoYear(dateStr: string | null): number {
  return dateStr ? new Date(dateStr).getFullYear() : -1
}
function isoMonth(dateStr: string | null): number {
  return dateStr ? new Date(dateStr).getMonth() : -1  // 0-indexed
}
function isoQuarter(dateStr: string | null): number {
  return Math.floor(isoMonth(dateStr) / 3)  // 0-indexed
}

const INACTIVE_WIP_STATUSES = new Set(['Settled', 'Withdrawn', 'Lapsed'])
const INACTIVE_LISTING_STATUSES = new Set(['Sold', 'Withdrawn'])

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const [wip, listings, forecast] = await Promise.all([
    getWIP(),
    getActiveListings(),
    getFeeForecast(),
  ])

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const quarter = Math.floor(month / 3)

  // Active WIP (exclude dead statuses)
  const activeWIP = wip.filter((r) => !INACTIVE_WIP_STATUSES.has(r.status ?? ''))
  const activeListings = listings.filter((r) => !INACTIVE_LISTING_STATUSES.has(r.status ?? ''))

  // Settled vs unsettled forecast rows
  const settled = forecast.filter((r) => r.status === 'Settled')
  const unsettled = forecast.filter((r) => r.status !== 'Settled')

  const settledYTD = settled.filter((r) => isoYear(r.settlementDate) === year)

  const forecastThisMonth = unsettled.filter(
    (r) => isoYear(r.settlementDate) === year && isoMonth(r.settlementDate) === month,
  )
  const forecastThisQuarter = unsettled.filter(
    (r) => isoYear(r.settlementDate) === year && isoQuarter(r.settlementDate) === quarter,
  )

  const sum = (rows: { fee: number | null }[]) =>
    rows.reduce((acc, r) => acc + (r.fee ?? 0), 0)

  return {
    wipCount: activeWIP.length,
    wipTotalValue: activeWIP.reduce((acc, r) => acc + (r.value ?? 0), 0),
    wipTotalFee: activeWIP.reduce((acc, r) => acc + (r.fee ?? 0), 0),
    activeListingsCount: activeListings.length,
    activeListingsTotalValue: activeListings.reduce((acc, r) => acc + (r.price ?? 0), 0),
    activeListingsTotalFee: activeListings.reduce((acc, r) => acc + (r.fee ?? 0), 0),
    forecastFeeThisMonth: sum(forecastThisMonth),
    forecastFeeThisQuarter: sum(forecastThisQuarter),
    settledFeeYTD: sum(settledYTD),
    totalForecastFee: sum(unsettled),
    usingMockData: !workbookExists(),
  }
}

// ─── Agent summary ────────────────────────────────────────────────────────────

const AGENT_COLUMNS: Array<{ name: string; key: keyof FeeForecastRow }> = [
  { name: 'Miron Solomons',  key: 'mironSolomons' },
  { name: 'Matt Pontey',     key: 'mattPontey' },
  { name: 'Henry Robertson', key: 'henryRobertson' },
  { name: 'Jake Smith',      key: 'jakeSmith' },
]

export async function getAgentSummaries(): Promise<AgentSummary[]> {
  const forecast = await getFeeForecast()

  const totalFees = forecast.reduce((acc, r) => acc + (r.fee ?? 0), 0)

  return AGENT_COLUMNS.map(({ name, key }) => {
    const agentRows = forecast.filter((r) => ((r[key] as number | null) ?? 0) > 0)
    const settledRows = agentRows.filter((r) => r.status === 'Settled')
    const forecastRows = agentRows.filter((r) => r.status !== 'Settled')

    const agentTotal = agentRows.reduce((acc, r) => acc + ((r[key] as number | null) ?? 0), 0)
    const agentSettled = settledRows.reduce((acc, r) => acc + ((r[key] as number | null) ?? 0), 0)
    const agentForecast = forecastRows.reduce((acc, r) => acc + ((r[key] as number | null) ?? 0), 0)

    return {
      name,
      totalFee: agentTotal,
      settledFee: agentSettled,
      forecastFee: agentForecast,
      dealCount: agentRows.length,
      avgDealFee: agentRows.length > 0 ? agentTotal / agentRows.length : 0,
      shareOfTotal: totalFees > 0 ? agentTotal / totalFees : 0,
    }
  })
}
