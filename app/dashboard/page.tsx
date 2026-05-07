const KPI_PLACEHOLDERS = [
  { label: 'Total WIP Value',          value: '—',   sub: 'Stage 2 data' },
  { label: 'Total WIP Fee',            value: '—',   sub: 'Stage 2 data' },
  { label: 'Active Listings Value',    value: '—',   sub: 'Stage 2 data' },
  { label: 'Active Listings Fee',      value: '—',   sub: 'Stage 2 data' },
  { label: 'Forecast Fees This Month', value: '—',   sub: 'Stage 2 data' },
  { label: 'Forecast Fees This Qtr',   value: '—',   sub: 'Stage 2 data' },
  { label: 'Settled Fees YTD',         value: '—',   sub: 'Stage 2 data' },
  { label: 'Active Submissions',       value: '—',   sub: 'Stage 2 data' },
  { label: 'Active Listings',          value: '—',   sub: 'Stage 2 data' },
]

export default function DashboardPage() {
  return (
    <div className="p-8">
      {/* Page header */}
      <div className="mb-8">
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

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
        {KPI_PLACEHOLDERS.map(({ label, value, sub }) => (
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

      {/* Chart placeholders */}
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
          <p className="text-slate-400 text-xs">Charts available in Stage 3</p>
        </div>
      </div>
    </div>
  )
}
