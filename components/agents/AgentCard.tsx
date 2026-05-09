import type { AgentPerformance } from '@/lib/data/compute-agents'
import { fmtCurrency } from '@/lib/table-utils'

const AVATAR_COLORS = [
  'bg-cw-red',
  'bg-blue-600',
  'bg-cw-green',
  'bg-amber-500',
  'bg-purple-600',
  'bg-cyan-600',
  'bg-rose-500',
  'bg-indigo-600',
]

interface Props {
  perf: AgentPerformance
  index: number
}

function Metric({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className={`text-sm font-semibold ${className || 'text-gray-800'}`}>{value}</p>
    </div>
  )
}

export default function AgentCard({ perf, index }: Props) {
  const avatarColor = AVATAR_COLORS[index % AVATAR_COLORS.length]
  const hasData = perf.totalFee > 0 || perf.wipDeals > 0

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-5 hover:shadow-sm transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 ${avatarColor} rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm`}>
            {perf.initials}
          </div>
          <div>
            <p className="font-semibold text-gray-900 leading-tight">{perf.agent.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {perf.forecastDeals} forecast deal{perf.forecastDeals !== 1 ? 's' : ''}
              {perf.wipDeals > 0 && ` · ${perf.wipDeals} in WIP`}
            </p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-[11px] text-gray-400 mb-0.5">Total Fee</p>
          <p className="text-lg font-bold text-gray-900 leading-none">{fmtCurrency(perf.totalFee)}</p>
        </div>
      </div>

      {/* Share of total bar */}
      {hasData && (
        <div>
          <div className="flex justify-between text-[11px] text-gray-400 mb-1.5">
            <span>Share of total fees</span>
            <span className="font-semibold text-gray-600">{perf.shareOfTotal.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full ${avatarColor} rounded-full transition-all`}
              style={{ width: `${Math.min(perf.shareOfTotal, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        <Metric label="Settled Fee"    value={fmtCurrency(perf.settledFee)}  className="text-cw-green" />
        <Metric label="Forecast Fee"   value={fmtCurrency(perf.forecastFee)} className="text-amber-600" />
        <Metric label="WIP Deals"      value={`${perf.wipDeals} deal${perf.wipDeals !== 1 ? 's' : ''}`} className="text-blue-600" />
        <Metric label="Avg Fee / Deal" value={perf.avgFee > 0 ? fmtCurrency(perf.avgFee) : '—'} />
      </div>

      {/* WIP pipeline value */}
      {perf.wipValue > 0 && (
        <div className="pt-3 border-t border-gray-100">
          <p className="text-[11px] text-gray-400 mb-0.5">WIP Pipeline Value</p>
          <p className="text-sm font-semibold text-gray-700">{fmtCurrency(perf.wipValue)}</p>
        </div>
      )}

      {!hasData && (
        <p className="text-xs text-gray-400 italic">No data yet — add deals to the spreadsheet to see metrics here.</p>
      )}
    </div>
  )
}
