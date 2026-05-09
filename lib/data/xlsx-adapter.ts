import fs from 'fs'
import path from 'path'
import type { DataAdapter, WIPRow, ListingRow, ForecastRow } from './types'
import { parseWIPSheet } from './parse-wip'
import { parseListingsSheet } from './parse-listings'
import { parseForecastSheet } from './parse-forecast'

const WORKBOOK_PATH = path.join(process.cwd(), 'data', 'workbook.xlsx')

// Module-level cache — workbook is read once per server process
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _cached: any | null = null

function loadWorkbook() {
  if (_cached) return _cached
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require('xlsx') as typeof import('xlsx')
  if (!fs.existsSync(WORKBOOK_PATH)) {
    console.warn(`[data] Workbook not found at ${WORKBOOK_PATH} — returning empty data`)
    return null
  }
  const buffer = fs.readFileSync(WORKBOOK_PATH)
  _cached = XLSX.read(buffer, { type: 'buffer' })
  return _cached
}

export class XLSXAdapter implements DataAdapter {
  async getWIP(): Promise<WIPRow[]> {
    const wb = loadWorkbook()
    if (!wb) return []
    const ws = wb.Sheets['WIP']
    if (!ws) return []
    return parseWIPSheet(ws)
  }

  async getListings(): Promise<ListingRow[]> {
    const wb = loadWorkbook()
    if (!wb) return []
    const ws = wb.Sheets['Active Listings']
    if (!ws) return []
    return parseListingsSheet(ws)
  }

  async getForecast(): Promise<ForecastRow[]> {
    const wb = loadWorkbook()
    if (!wb) return []
    const ws = wb.Sheets['Fee Forecast']
    if (!ws) return []
    return parseForecastSheet(ws)
  }
}
