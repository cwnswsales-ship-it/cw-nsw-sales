import type { WorkSheet } from 'xlsx'
import type { WIPRow } from './types'
import { excelDateToDate } from './excel-date'

function normaliseCampaignType(val: unknown): string {
  if (!val || typeof val !== 'string') return ''
  const t = val.trim()
  if (t === '-') return 'Other'
  // Collapse known variants
  if (t.toLowerCase() === 'off-market' || t.toLowerCase() === 'off market') return 'Off Market'
  return t
}

function normaliseAssetType(val: unknown): string {
  if (!val || typeof val !== 'string') return ''
  return val.trim()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseWIPSheet(ws: WorkSheet): WIPRow[] {
  // Avoid importing XLSX at module level — caller passes the worksheet
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require('xlsx') as typeof import('xlsx')
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

  // Row 0: empty title row
  // Row 1: headers  ["Date","Rating","Address","Vendor","Value","Fee","Land Area","Agent 1","Agent 2","Agent 3","Status","Campaign Type","Asset Type"]
  // Row 2+: data
  const result: WIPRow[] = []

  for (let i = 2; i < rows.length; i++) {
    const r = rows[i]
    if (!r || !r[2]) continue // must have an address

    result.push({
      date: excelDateToDate(r[0]),
      rating: typeof r[1] === 'string' ? r[1].trim() : '',
      address: typeof r[2] === 'string' ? r[2].trim() : String(r[2] ?? ''),
      vendor: typeof r[3] === 'string' ? r[3].trim() : '',
      value: typeof r[4] === 'number' ? r[4] : null,
      fee: typeof r[5] === 'number' ? r[5] : null,
      landArea: typeof r[6] === 'number' ? r[6] : null,
      agent1: typeof r[7] === 'string' ? r[7].trim() : '',
      agent2: typeof r[8] === 'string' ? r[8].trim() : '',
      agent3: typeof r[9] === 'string' ? r[9].trim() : '',
      status: typeof r[10] === 'string' ? r[10].trim() : '',
      campaignType: normaliseCampaignType(r[11]),
      assetType: normaliseAssetType(r[12]),
    })
  }

  return result
}
