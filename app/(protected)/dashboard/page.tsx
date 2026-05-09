import Header from '@/components/layout/Header'
import { DollarSign, Building2, TrendingUp, FileText, Users, CheckCircle } from 'lucide-react'

const kpiCards = [
  { label: 'Total WIP Value', icon: DollarSign, color: 'blue' },
  { label: 'Total WIP Fee', icon: TrendingUp, color: 'blue' },
  { label: 'Active Listings Value', icon: Building2, color: 'green' },
  { label: 'Active Listings Fee', icon: Building2, color: 'green' },
  { label: 'Forecast Fees (Month)', icon: TrendingUp, color: 'red' },
  { label: 'Forecast Fees (Quarter)', icon: TrendingUp, color: 'red' },
  { label: 'Settled Fees YTD', icon: CheckCircle, color: 'green' },
  { label: 'Active Submissions', icon: FileText, color: 'blue' },
  { label: 'Active Listings Count', icon: Users, color: 'blue' },
]

const chartPlaceholders = [
  'Fees by Agent',
  'Fees by Month',
  'WIP by Status',
  'Active Listings by Asset Class',
  'Pipeline by Rating',
]

const colorMap: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-cw-green-light text-cw-green',
  red: 'bg-red-50 text-cw-red',
}

export default function DashboardPage() {
  return (
    <>
      <Header
        title="Dashboard"
        subtitle="— Investment Sales NSW Overview"
      />
      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-7xl mx-auto space-y-8">

          {/* Stage notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 flex items-start gap-3">
            <span className="text-blue-500 text-lg mt-0.5">ℹ</span>
            <div>
              <p className="text-sm font-medium text-blue-800">Stage 1 Complete — Shell Ready</p>
              <p className="text-sm text-blue-600 mt-0.5">
                KPI cards and charts will be populated in Stage 3 once the data layer is connected in Stage 2.
              </p>
            </div>
          </div>

          {/* KPI Cards */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Key Metrics
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {kpiCards.map(({ label, icon: Icon, color }) => (
                <div
                  key={label}
                  className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4"
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${colorMap[color]}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-500 mb-1.5">{label}</p>
                    <div className="h-7 bg-gray-100 rounded-md w-28 animate-pulse" />
                    <div className="h-3 bg-gray-50 rounded w-16 mt-2 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Charts */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Charts &amp; Analytics
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {chartPlaceholders.map(label => (
                <div
                  key={label}
                  className="bg-white rounded-xl border border-gray-200 p-6"
                >
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">{label}</h3>
                  <div className="h-52 bg-gray-50 rounded-lg flex flex-col items-center justify-center gap-2 border border-dashed border-gray-200">
                    <TrendingUp className="w-8 h-8 text-gray-300" />
                    <p className="text-sm text-gray-400">Chart data coming in Stage 3</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>
    </>
  )
}
