import type { WorkSheet } from 'xlsx'
import type { ForecastRow } from './types'
import { excelDateToDate } from './excel-date'

function toNum(val: unknown): number | null {
  if (typeof val === 'number') return val
  return null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseForecastSheet(ws: WorkSheet): ForecastRow[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require('xlsx') as typeof import('xlsx')
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

  // Row 0: empty
  // Row 1: "Fee Split" label row
  // Row 2: headers ["Address","Vendor","Purchaser","Value","Settlement Date","Status","Fee","Miron Solomons","Matt Pontey","Henry Robertson","Jake Smith","X",...]
  // Row 3+: data
  const result: ForecastRow[] = []

  for (let i = 3; i < rows.length; i++) {
    const r = rows[i]
    if (!r || !r[0]) continue // must have an address

    result.push({
      address: typeof r[0] === 'string' ? r[0].trim() : String(r[0] ?? ''),
      vendor: typeof r[1] === 'string' ? r[1].trim() : '',
      purchaser: typeof r[2] === 'string' ? r[2].trim() : '',
      value: toNum(r[3]),
      settlementDate: excelDateToDate(r[4]),
      status: typeof r[5] === 'string' ? r[5].trim() : '',
      fee: toNum(r[6]),
      mironSolomons: toNum(r[7]),
      mattPontey: toNum(r[8]),
      henryRobertson: toNum(r[9]),
      jakeSmith: toNum(r[10]),
      x: toNum(r[11]),
    })
  }

  return result
}
