'use client'

import { useState, useMemo } from 'react'
import { Download, Search, X } from 'lucide-react'
import StatusBadge from '@/components/ui/StatusBadge'
import { exportToCSV, fmtCurrency, fmtDate } from '@/lib/table-utils'

export interface ListingTableRow {
  date: string | null
  address: string
  vendor: string
  price: number | null
  fee: number | null
  agents: string
  status: string
  closeDate: string | null
  process: string
  assetClass: string
}

type SortKey = keyof ListingTableRow
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

export default function ListingsTable({ data }: { data: ListingTableRow[] }) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [assetClass, setAssetClass] = useState('')
  const [process, setProcess] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>({ key: 'date', dir: 'desc' })

  const statuses = useMemo(() => uniq(data.map(r => r.status)), [data])
  const assetClasses = useMemo(() => uniq(data.map(r => r.assetClass)), [data])
  const processes = useMemo(() => uniq(data.map(r => r.process)), [data])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return data.filter(r => {
      if (status && r.status !== status) return false
      if (assetClass && r.assetClass !== assetClass) return false
      if (process && r.process !== process) return false
      if (q && !r.address.toLowerCase().includes(q) && !r.vendor.toLowerCase().includes(q) && !r.agents.toLowerCase().includes(q)) return false
      return true
    })
  }, [data, search, status, assetClass, process])

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

  const hasFilters = !!(search || status || assetClass || process)
  const clearFilters = () => { setSearch(''); setStatus(''); setAssetClass(''); setProcess('') }

  const handleExport = () => exportToCSV(
    ['Date', 'Address', 'Vendor', 'Price', 'Fee', 'Agents', 'Status', 'Close Date', 'Process', 'Asset Class'],
    sorted.map(r => [r.date, r.address, r.vendor, r.price, r.fee, r.agents, r.status, r.closeDate, r.process, r.assetClass]),
    'active-listings-export.csv'
  )

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search address, vendor or agents…"
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cw-red/20 focus:border-cw-red"
            />
          </div>

          {[
            { label: 'Status', val: status, set: setStatus, opts: statuses },
            { label: 'Asset Class', val: assetClass, set: setAssetClass, opts: assetClasses },
            { label: 'Process', val: process, set: setProcess, opts: processes },
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
            <span className="text-sm text-gray-400">{sorted.length} of {data.length} listings</span>
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
                <SortTh label="Date"        col="date"       sort={sort} onSort={toggleSort} />
                <SortTh label="Address"     col="address"    sort={sort} onSort={toggleSort} />
                <SortTh label="Vendor"      col="vendor"     sort={sort} onSort={toggleSort} />
                <SortTh label="Price"       col="price"      sort={sort} onSort={toggleSort} align="right" />
                <SortTh label="Fee"         col="fee"        sort={sort} onSort={toggleSort} align="right" />
                <SortTh label="Agents"      col="agents"     sort={sort} onSort={toggleSort} />
                <SortTh label="Status"      col="status"     sort={sort} onSort={toggleSort} />
                <SortTh label="Close Date"  col="closeDate"  sort={sort} onSort={toggleSort} />
                <SortTh label="Process"     col="process"    sort={sort} onSort={toggleSort} />
                <SortTh label="Asset Class" col="assetClass" sort={sort} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-sm text-gray-400">
                    No results match your filters.
                  </td>
                </tr>
              ) : sorted.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{fmtDate(r.date)}</td>
                  <td className="px-3 py-2.5 font-medium text-gray-900 max-w-64">
                    <span className="block truncate" title={r.address}>{r.address}</span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-600 max-w-40">
                    <span className="block truncate" title={r.vendor}>{r.vendor || '—'}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-medium text-gray-900 whitespace-nowrap">{fmtCurrency(r.price)}</td>
                  <td className="px-3 py-2.5 text-right text-cw-green font-medium whitespace-nowrap">{fmtCurrency(r.fee)}</td>
                  <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">
                    <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{r.agents || '—'}</span>
                  </td>
                  <td className="px-3 py-2.5"><StatusBadge value={r.status} /></td>
                  <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{fmtDate(r.closeDate)}</td>
                  <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{r.process || '—'}</td>
                  <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{r.assetClass || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sorted.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex justify-between text-xs text-gray-400">
            <span>{sorted.length} listings shown</span>
            <span>
              Total price: <strong className="text-gray-700">{fmtCurrency(sorted.reduce((s, r) => s + (r.price ?? 0), 0))}</strong>
              {' · '}
              Total fee: <strong className="text-cw-green">{fmtCurrency(sorted.reduce((s, r) => s + (r.fee ?? 0), 0))}</strong>
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
