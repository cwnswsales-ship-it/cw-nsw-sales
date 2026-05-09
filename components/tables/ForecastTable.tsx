'use client'

import { useState, useMemo } from 'react'
import { Download, Search, X } from 'lucide-react'
import StatusBadge from '@/components/ui/StatusBadge'
import { exportToCSV, fmtCurrency, fmtDate } from '@/lib/table-utils'

export interface ForecastTableRow {
  address: string
  vendor: string
  purchaser: string
  value: number | null
  settlementDate: string | null
  settlementMonth: string    // "May 2026" — for month filter
  settlementQuarter: string  // "Q2 2026" — for quarter filter
  status: string
  fee: number | null
  mironSolomons: number | null
  mattPontey: number | null
  henryRobertson: number | null
  jakeSmith: number | null
  x: number | null
}

type SortKey = keyof ForecastTableRow
type SortDir = 'asc' | 'desc'

function uniq(arr: string[]) {
  return [...new Set(arr.filter(Boolean))].sort()
}

function SortTh({
  label, col, sort, onSort, align = 'left',
}: {
  label: string; col: SortKey; sort: { key: SortKey; dir: SortDir } | null
  onSort: (k: SortKey) => void; align?: 'left' | 'right'
}) {
  const active = sort?.key === col
  return (
    <th
      onClick={() => onSort(col)}
      className={`px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none whitespace-nowrap hover:text-gray-900 transition-colors ${align === 'right' ? 'text-right' : 'text-left'}`}
    >
      <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
        {label}
        <span className={active ? 'text-cw-red' : 'text-gray-300'}>
          {active ? (sort!.dir === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </span>
    </th>
  )
}

export default function ForecastTable({ data }: { data: ForecastTableRow[] }) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [month, setMonth] = useState('')
  const [quarter, setQuarter] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>({ key: 'settlementDate', dir: 'asc' })

  const statuses = useMemo(() => uniq(data.map(r => r.status)), [data])
  const months = useMemo(() => uniq(data.map(r => r.settlementMonth)), [data])
  const quarters = useMemo(() => uniq(data.map(r => r.settlementQuarter)), [data])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return data.filter(r => {
      if (status && r.status !== status) return false
      if (month && r.settlementMonth !== month) return false
      if (quarter && r.settlementQuarter !== quarter) return false
      if (q && !r.address.toLowerCase().includes(q) && !r.vendor.toLowerCase().includes(q) && !r.purchaser.toLowerCase().includes(q)) return false
      return true
    })
  }, [data, search, status, month, quarter])

  const sorted = useMemo(() => {
    if (!sort) return filtered
    return [...filtered].sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key]
      if (av == null) return 1; if (bv == null) return -1
      if (typeof av === 'number' && typeof bv === 'number') return sort.dir === 'asc' ? av - bv : bv - av
      return sort.dir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
    })
  }, [filtered, sort])

  const toggleSort = (key: SortKey) =>
    setSort(prev => (!prev || prev.key !== key) ? { key, dir: 'asc' } : prev.dir === 'asc' ? { key, dir: 'desc' } : null)

  const hasFilters = !!(search || status || month || quarter)
  const clearFilters = () => { setSearch(''); setStatus(''); setMonth(''); setQuarter('') }

  const handleExport = () => exportToCSV(
    ['Address', 'Vendor', 'Purchaser', 'Value', 'Settlement Date', 'Status', 'Fee', 'Miron Solomons', 'Matt Pontey', 'Henry Robertson', 'Jake Smith', 'X'],
    sorted.map(r => [r.address, r.vendor, r.purchaser, r.value, r.settlementDate, r.status, r.fee, r.mironSolomons, r.mattPontey, r.henryRobertson, r.jakeSmith, r.x]),
    'fee-forecast-export.csv'
  )

  const agentCols = [
    { key: 'mironSolomons' as SortKey, label: 'Miron S.' },
    { key: 'mattPontey' as SortKey,    label: 'Matt P.' },
    { key: 'henryRobertson' as SortKey, label: 'Henry R.' },
    { key: 'jakeSmith' as SortKey,     label: 'Jake S.' },
    { key: 'x' as SortKey,             label: 'X' },
  ]

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search address, vendor or purchaser…"
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cw-red/20 focus:border-cw-red"
            />
          </div>

          {[
            { label: 'Status', val: status, set: setStatus, opts: statuses },
            { label: 'Month', val: month, set: setMonth, opts: months },
            { label: 'Quarter', val: quarter, set: setQuarter, opts: quarters },
          ].map(({ label, val, set, opts }) => (
            <select
              key={label}
              value={val} onChange={e => set(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-cw-red/20 focus:border-cw-red"
            >
              <option value="">{label}: All</option>
              {opts.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ))}

          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-cw-red transition-colors">
              <X className="w-3.5 h-3.5" /> Clear
            </button>
          )}

          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-gray-400">{sorted.length} of {data.length} deals</span>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-cw-red hover:bg-cw-red-dark rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <SortTh label="Address"     col="address"        sort={sort} onSort={toggleSort} />
                <SortTh label="Vendor"      col="vendor"         sort={sort} onSort={toggleSort} />
                <SortTh label="Purchaser"   col="purchaser"      sort={sort} onSort={toggleSort} />
                <SortTh label="Value"       col="value"          sort={sort} onSort={toggleSort} align="right" />
                <SortTh label="Settlement"  col="settlementDate" sort={sort} onSort={toggleSort} />
                <SortTh label="Status"      col="status"         sort={sort} onSort={toggleSort} />
                <SortTh label="Total Fee"   col="fee"            sort={sort} onSort={toggleSort} align="right" />
                {agentCols.map(({ key, label }) => (
                  <SortTh key={key} label={label} col={key} sort={sort} onSort={toggleSort} align="right" />
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-6 py-12 text-center text-sm text-gray-400">
                    No results match your filters.
                  </td>
                </tr>
              ) : sorted.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2.5 font-medium text-gray-900 max-w-52">
                    <span className="block truncate" title={r.address}>{r.address}</span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-600 max-w-36">
                    <span className="block truncate" title={r.vendor}>{r.vendor || '—'}</span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-600 max-w-36">
                    <span className="block truncate" title={r.purchaser}>{r.purchaser || '—'}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-medium text-gray-900 whitespace-nowrap">{fmtCurrency(r.value)}</td>
                  <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{fmtDate(r.settlementDate)}</td>
                  <td className="px-3 py-2.5"><StatusBadge value={r.status} /></td>
                  <td className="px-3 py-2.5 text-right font-semibold text-gray-900 whitespace-nowrap">{fmtCurrency(r.fee)}</td>
                  {agentCols.map(({ key }) => (
                    <td key={key} className="px-3 py-2.5 text-right text-cw-green whitespace-nowrap">
                      {r[key] ? fmtCurrency(r[key] as number) : <span className="text-gray-300">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sorted.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex justify-between text-xs text-gray-400">
            <span>{sorted.length} deals shown</span>
            <span>
              Total fees: <strong className="text-gray-700">{fmtCurrency(sorted.reduce((s, r) => s + (r.fee ?? 0), 0))}</strong>
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
