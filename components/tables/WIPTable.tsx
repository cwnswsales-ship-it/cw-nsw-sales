'use client'

import { useState, useMemo } from 'react'
import { Download, Search, X } from 'lucide-react'
import StatusBadge from '@/components/ui/StatusBadge'
import { exportToCSV, fmtCurrency, fmtDate } from '@/lib/table-utils'

export interface WIPTableRow {
  date: string | null
  rating: string
  address: string
  vendor: string
  value: number | null
  fee: number | null
  landArea: number | null
  agent1: string
  agent2: string
  agent3: string
  status: string
  campaignType: string
  assetType: string
}

type SortKey = keyof WIPTableRow
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

export default function WIPTable({ data }: { data: WIPTableRow[] }) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [rating, setRating] = useState('')
  const [agent, setAgent] = useState('')
  const [campaign, setCampaign] = useState('')
  const [assetType, setAssetType] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>({ key: 'date', dir: 'desc' })

  const statuses = useMemo(() => uniq(data.map(r => r.status)), [data])
  const ratings = useMemo(() => uniq(data.map(r => r.rating)), [data])
  const agents = useMemo(() => uniq(data.flatMap(r => [r.agent1, r.agent2, r.agent3])), [data])
  const campaigns = useMemo(() => uniq(data.map(r => r.campaignType)), [data])
  const assetTypes = useMemo(() => uniq(data.map(r => r.assetType)), [data])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return data.filter(r => {
      if (status && r.status !== status) return false
      if (rating && r.rating !== rating) return false
      if (agent && r.agent1 !== agent && r.agent2 !== agent && r.agent3 !== agent) return false
      if (campaign && r.campaignType !== campaign) return false
      if (assetType && r.assetType !== assetType) return false
      if (q && !r.address.toLowerCase().includes(q) && !r.vendor.toLowerCase().includes(q)) return false
      return true
    })
  }, [data, search, status, rating, agent, campaign, assetType])

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

  const hasFilters = !!(search || status || rating || agent || campaign || assetType)
  const clearFilters = () => { setSearch(''); setStatus(''); setRating(''); setAgent(''); setCampaign(''); setAssetType('') }

  const handleExport = () => exportToCSV(
    ['Date', 'Rating', 'Address', 'Vendor', 'Value', 'Fee', 'Land Area (m²)', 'Agent 1', 'Agent 2', 'Agent 3', 'Status', 'Campaign Type', 'Asset Type'],
    sorted.map(r => [r.date, r.rating, r.address, r.vendor, r.value, r.fee, r.landArea, r.agent1, r.agent2, r.agent3, r.status, r.campaignType, r.assetType]),
    'wip-export.csv'
  )

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search address or vendor…"
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cw-red/20 focus:border-cw-red"
            />
          </div>

          {[
            { label: 'Status', val: status, set: setStatus, opts: statuses },
            { label: 'Rating', val: rating, set: setRating, opts: ratings },
            { label: 'Agent', val: agent, set: setAgent, opts: agents },
            { label: 'Campaign', val: campaign, set: setCampaign, opts: campaigns },
            { label: 'Asset Type', val: assetType, set: setAssetType, opts: assetTypes },
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
                <SortTh label="Date"          col="date"         sort={sort} onSort={toggleSort} />
                <SortTh label="Rating"        col="rating"       sort={sort} onSort={toggleSort} />
                <SortTh label="Address"       col="address"      sort={sort} onSort={toggleSort} />
                <SortTh label="Vendor"        col="vendor"       sort={sort} onSort={toggleSort} />
                <SortTh label="Value"         col="value"        sort={sort} onSort={toggleSort} align="right" />
                <SortTh label="Fee"           col="fee"          sort={sort} onSort={toggleSort} align="right" />
                <SortTh label="Land (m²)"     col="landArea"     sort={sort} onSort={toggleSort} align="right" />
                <SortTh label="Agent 1"       col="agent1"       sort={sort} onSort={toggleSort} />
                <SortTh label="Agent 2"       col="agent2"       sort={sort} onSort={toggleSort} />
                <SortTh label="Agent 3"       col="agent3"       sort={sort} onSort={toggleSort} />
                <SortTh label="Status"        col="status"       sort={sort} onSort={toggleSort} />
                <SortTh label="Campaign"      col="campaignType" sort={sort} onSort={toggleSort} />
                <SortTh label="Asset Type"    col="assetType"    sort={sort} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-6 py-12 text-center text-sm text-gray-400">
                    No results match your filters.
                  </td>
                </tr>
              ) : sorted.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{fmtDate(r.date)}</td>
                  <td className="px-3 py-2.5"><StatusBadge value={r.rating} variant="rating" /></td>
                  <td className="px-3 py-2.5 font-medium text-gray-900 max-w-56">
                    <span className="block truncate" title={r.address}>{r.address}</span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-600 max-w-36">
                    <span className="block truncate" title={r.vendor}>{r.vendor || '—'}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-medium text-gray-900 whitespace-nowrap">{fmtCurrency(r.value)}</td>
                  <td className="px-3 py-2.5 text-right text-cw-green font-medium whitespace-nowrap">{fmtCurrency(r.fee)}</td>
                  <td className="px-3 py-2.5 text-right text-gray-600 whitespace-nowrap">
                    {r.landArea ? r.landArea.toLocaleString('en-AU') : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{r.agent1 || '—'}</td>
                  <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{r.agent2 || '—'}</td>
                  <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{r.agent3 || '—'}</td>
                  <td className="px-3 py-2.5"><StatusBadge value={r.status} /></td>
                  <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{r.campaignType || '—'}</td>
                  <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{r.assetType || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        {sorted.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex justify-between text-xs text-gray-400">
            <span>{sorted.length} deals shown</span>
            <span>
              Total value: <strong className="text-gray-700">{fmtCurrency(sorted.reduce((s, r) => s + (r.value ?? 0), 0))}</strong>
              {' · '}
              Total fee: <strong className="text-cw-green">{fmtCurrency(sorted.reduce((s, r) => s + (r.fee ?? 0), 0))}</strong>
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
