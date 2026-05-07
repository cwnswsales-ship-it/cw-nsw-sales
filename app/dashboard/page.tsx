import { getDashboardSummary } from '@/lib/data'

// ─── Currency formatter ───────────────────────────────────────────────────────
function aud(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}k`
  }
  return `$${value.toLocaleString('en-AU')}`
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const summary = await getDashboardSummary()

  const kpis = [
    {
      label: 'Total WIP Value',
      value: aud(summary.wipTotalValue),
      sub: `${summary.wipCount} active submissions`,
    },
    {
      label: 'Total WIP Fee',
      value: aud(summary.wipTotalFee),
      sub: 'Estimated commission',
    },
    {
      label: 'Active Listings Value',
      value: aud(summary.activeListingsTotalValue),
      sub: `${summary.activeListingsCount} properties on market`,
    },
    {
      label: 'Active Listings Fee',
      value: aud(summary.activeListingsTotalFee),
      sub: 'Estimated commission',
    },
    {
      label: 'Forecast Fees This Month',
      value: summary.forecastFeeThisMonth > 0 ? aud(summary.forecastFeeThisMonth) : '—',
      sub: 'Expected settlements',
    },
    {
      label: 'Forecast Fees This Quarter',
      value: summary.forecastFeeThisQuarter > 0 ? aud(summary.forecastFeeThisQuarter) : '—',
      sub: 'Expected settlements',
    },
    {
      label: 'Settled Fees YTD',
      value: aud(summary.settledFeeYTD),
      sub: `${new Date().getFullYear()} year to date`,
    },
    {
      label: 'Total Forecast Pipeline',
      value: aud(summary.totalForecastFee),
      sub: 'All unsettled deals',
    },
  ]

  return (
    <div className="p-8">
      {/* Page header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-slate-400 mb-1">
            Overview
          </p>
          <h1 className="text-2xl font-bold" style={{ color: '#0C2340' }}>
            Dashboard
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Investment Sales NSW · WIP Pipeline
          </p>
        </div>

        {/* Data source badge */}
        {summary.usingMockData && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium px-3 py-1.5 rounded-full mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
            Sample data — drop workbook.xlsx in /data to connect
          </div>
        )}
        {!summary.usingMockData && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-xs font-medium px-3 py-1.5 rounded-full mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
            Live data · workbook.xlsx
          </div>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
        {kpis.map(({ label, value, sub }) => (
          <div
            key={label}
            className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm"
          >
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-2">
              {label}
            </p>
            <p className="text-2xl font-bold" style={{ color: '#0C2340' }}>
              {value}
            </p>
            <p className="text-xs text-slate-400 mt-1.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Chart placeholders — built in Stage 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <ChartPlaceholder title="Fees by Agent" />
        <ChartPlaceholder title="Fees by Month" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartPlaceholder title="WIP by Status" />
        <ChartPlaceholder title="Listings by Asset Class" />
        <ChartPlaceholder title="Pipeline by Rating" />
      </div>
    </div>
  )
}

function ChartPlaceholder({ title }: { title: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 h-64 flex flex-col">
      <p className="text-sm font-semibold text-slate-700 mb-4">{title}</p>
      <div className="flex-1 flex items-center justify-center rounded-lg bg-slate-50">
        <div className="text-center">
          <div className="w-8 h-8 rounded-full bg-slate-200 mx-auto mb-2 flex items-center justify-center">
            <span className="text-slate-400 text-xs">✦</span>
          </div>
          <p className="text-slate-400 text-xs">Charts in Stage 3</p>
        </div>
      </div>
    </div>
  )
}
