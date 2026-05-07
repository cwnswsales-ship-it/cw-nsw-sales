/**
 * XLSX sheet parsers.
 * Each function reads a named sheet from the workbook file and returns
 * typed rows. Column name matching is intentionally flexible (case-insensitive,
 * common alias variants) so that minor header differences in the real workbook
 * are handled gracefully.
 */

import * as XLSX from 'xlsx'
import type { WIPRow, ActiveListingRow, FeeForecastRow } from './types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

type RawRow = Record<string, unknown>

function readSheet(filePath: string, sheetName: string): RawRow[] {
  try {
    const workbook = XLSX.readFile(filePath, { cellDates: true })
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) {
      console.warn(`[parsers] Sheet "${sheetName}" not found in workbook.`)
      return []
    }
    return XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: null, raw: false })
  } catch (err) {
    console.error(`[parsers] Failed to read sheet "${sheetName}":`, err)
    return []
  }
}

/** Return the first non-empty string value found among the given keys. */
function str(row: RawRow, ...keys: string[]): string | null {
  for (const key of keys) {
    const v = row[key]
    if (v != null && String(v).trim() !== '' && String(v).trim() !== 'null') {
      return String(v).trim()
    }
  }
  return null
}

/** Return the first numeric value found among the given keys, stripping $ and commas. */
function num(row: RawRow, ...keys: string[]): number | null {
  for (const key of keys) {
    const v = row[key]
    if (v != null && v !== '') {
      const cleaned = String(v).replace(/[$,\s]/g, '')
      const n = parseFloat(cleaned)
      if (!isNaN(n)) return n
    }
  }
  return null
}

/** Return the first valid ISO date string found among the given keys. */
function isoDate(row: RawRow, ...keys: string[]): string | null {
  for (const key of keys) {
    const v = row[key]
    if (v == null || v === '') continue
    if (v instanceof Date) {
      if (!isNaN(v.getTime())) return v.toISOString().split('T')[0]
    }
    const d = new Date(String(v))
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  }
  return null
}

// ─── WIP Parser ───────────────────────────────────────────────────────────────

export function parseWIP(filePath: string): WIPRow[] {
  const rows = readSheet(filePath, 'WIP')
  return rows
    .filter((r) => str(r, 'Address', 'address', 'ADDRESS'))
    .map((r, i) => ({
      id: String(i + 1),
      date: isoDate(r, 'Date', 'date', 'DATE'),
      rating: str(r, 'Rating', 'rating', 'RATING'),
      address: str(r, 'Address', 'address', 'ADDRESS') ?? '',
      vendor: str(r, 'Vendor', 'vendor', 'VENDOR'),
      value: num(r, 'Value', 'value', 'VALUE', 'Sale Price', 'Price'),
      fee: num(r, 'Fee', 'fee', 'FEE', 'Commission'),
      landArea: str(r, 'Land Area', 'Land area', 'land_area', 'landArea', 'Site Area'),
      agent1: str(r, 'Agent 1', 'Agent1', 'agent1', 'AGENT 1', 'Agent One'),
      agent2: str(r, 'Agent 2', 'Agent2', 'agent2', 'AGENT 2', 'Agent Two'),
      agent3: str(r, 'Agent 3', 'Agent3', 'agent3', 'AGENT 3', 'Agent Three'),
      status: str(r, 'Status', 'status', 'STATUS'),
      campaignType: str(
        r,
        'Campaign Type',
        'Campaign type',
        'campaign_type',
        'campaignType',
        'Campaign',
        'Method',
      ),
    }))
}

// ─── Active Listings Parser ───────────────────────────────────────────────────

export function parseActiveListings(filePath: string): ActiveListingRow[] {
  const rows = readSheet(filePath, 'Active Listings')
  return rows
    .filter((r) => str(r, 'Address', 'address', 'ADDRESS'))
    .map((r, i) => ({
      id: String(i + 1),
      date: isoDate(r, 'Date', 'date', 'DATE', 'Listed Date', 'Listing Date'),
      address: str(r, 'Address', 'address', 'ADDRESS') ?? '',
      vendor: str(r, 'Vendor', 'vendor', 'VENDOR', 'Vendor / Owner'),
      price: num(r, 'Price', 'price', 'PRICE', 'Value', 'Sale Price', 'Asking Price'),
      fee: num(r, 'Fee', 'fee', 'FEE', 'Commission'),
      agents: str(r, 'Agents', 'agents', 'AGENTS', 'Agent', 'Agent(s)'),
      status: str(r, 'Status', 'status', 'STATUS'),
      closeDate: isoDate(r, 'Close Date', 'Close date', 'close_date', 'closeDate', 'Closing Date'),
      process: str(r, 'Process', 'process', 'PROCESS', 'Method', 'Campaign Type'),
      assetClass: str(
        r,
        'Asset Class',
        'Asset class',
        'asset_class',
        'assetClass',
        'Property Type',
        'Type',
      ),
    }))
}

// ─── Fee Forecast Parser ──────────────────────────────────────────────────────

export function parseFeeForecast(filePath: string): FeeForecastRow[] {
  const rows = readSheet(filePath, 'Fee Forecast')
  return rows
    .filter((r) => str(r, 'Address', 'address', 'ADDRESS'))
    .map((r, i) => ({
      id: String(i + 1),
      address: str(r, 'Address', 'address', 'ADDRESS') ?? '',
      vendor: str(r, 'Vendor', 'vendor', 'VENDOR'),
      purchaser: str(r, 'Purchaser', 'purchaser', 'PURCHASER', 'Buyer'),
      value: num(r, 'Value', 'value', 'VALUE', 'Sale Price', 'Price'),
      settlementDate: isoDate(
        r,
        'Settlement Date',
        'Settlement date',
        'settlement_date',
        'settlementDate',
        'Settlement',
      ),
      status: str(r, 'Status', 'status', 'STATUS'),
      fee: num(r, 'Fee', 'fee', 'FEE', 'Total Fee', 'Commission'),
      mironSolomons: num(r, 'Miron Solomons', 'miron_solomons', 'Miron', 'MS'),
      mattPontey: num(r, 'Matt Pontey', 'matt_pontey', 'Matt', 'MP'),
      henryRobertson: num(r, 'Henry Robertson', 'henry_robertson', 'Henry', 'HR'),
      jakeSmith: num(r, 'Jake Smith', 'jake_smith', 'Jake', 'JS'),
      x: num(r, 'X', 'x', 'Other', 'Referral'),
    }))
}
