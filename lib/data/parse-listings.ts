import type { WorkSheet } from 'xlsx'
import type { ListingRow } from './types'
import { excelDateToDate } from './excel-date'

function normaliseStatus(val: unknown): string {
  if (!val || typeof val !== 'string') return ''
  const t = val.trim()
  // Fix obvious typos
  if (t === 'SOld') return 'Sold'
  if (t === 'On market ') return 'On Market'
  // Launch dates used as status — normalise to Active
  if (t.toLowerCase().startsWith('lanch')) return 'Active'
  return t
}

function normaliseProcess(val: unknown): string {
  if (!val || typeof val !== 'string') return ''
  const t = val.trim()
  if (t === '-') return 'Other'
  if (t === 'Off - Market') return 'Off Market'
  return t
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseListingsSheet(ws: WorkSheet): ListingRow[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require('xlsx') as typeof import('xlsx')
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

  // Row 0: headers ["Date","Address","Vendor","Price","Fee","Agents","Status","Close Date","Process","Asset Class",...]
  // Row 1+: data
  const result: ListingRow[] = []

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    if (!r || !r[1]) continue // must have an address

    result.push({
      date: excelDateToDate(r[0]),
      address: typeof r[1] === 'string' ? r[1].trim() : String(r[1] ?? ''),
      vendor: typeof r[2] === 'string' ? r[2].trim() : '',
      price: typeof r[3] === 'number' ? r[3] : null,
      fee: typeof r[4] === 'number' ? r[4] : null,
      agents: typeof r[5] === 'string' ? r[5].trim() : '',
      status: normaliseStatus(r[6]),
      closeDate: excelDateToDate(r[7]),
      process: normaliseProcess(r[8]),
      assetClass: typeof r[9] === 'string' ? r[9].trim() : '',
    })
  }

  return result
}
