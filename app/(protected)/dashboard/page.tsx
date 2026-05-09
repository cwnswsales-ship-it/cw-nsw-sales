import Header from '@/components/layout/Header'
import KPICard from '@/components/dashboard/KPICard'
import FeesByAgentChart from '@/components/charts/FeesByAgentChart'
import FeesByMonthChart from '@/components/charts/FeesByMonthChart'
import WIPByStatusChart from '@/components/charts/WIPByStatusChart'
import ListingsByAssetClassChart from '@/components/charts/ListingsByAssetClassChart'
import PipelineByRatingChart from '@/components/charts/PipelineByRatingChart'
import { getWIPData, getListingsData, getForecastData, formatCurrency } from '@/lib/data'
import {
  computeKPIs,
  computeAgentFeeData,
  computeFeesByMonthData,
  computeWIPByStatusData,
  computeListingsByAssetClassData,
  computePipelineByRatingData,
} from '@/lib/data/compute-kpis'
import {
  DollarSign,
  Building2,
  TrendingUp,
  FileText,
  CheckCircle,
  LayoutList,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const [wip, listings, forecast] = await Promise.all([
    getWIPData(),
    getListingsData(),
    getForecastData(),
  ])

  const kpis = computeKPIs(wip, listings, forecast)
  const agentFeeData = computeAgentFeeData(forecast)
  const feesByMonthData = computeFeesByMonthData(forecast)
  const wipByStatusData = computeWIPByStatusData(wip)
  const listingsByAssetClassData = computeListingsByAssetClassData(listings)
  const pipelineByRatingData = computePipelineByRatingData(wip)

  const kpiCards = [
    {
      label: 'Total WIP Value',
      value: formatCurrency(kpis.totalWIPValue),
      subtitle: 'Active pipeline (excl. lost/withdrawn)',
      Icon: DollarSign,
      color: 'blue' as const,
    },
    {
      label: 'Total WIP Fee',
      value: formatCurrency(kpis.totalWIPFee),
      subtitle: 'Potential fees from active pipeline',
      Icon: TrendingUp,
      color: 'blue' as const,
    },
    {
      label: 'Active Listings Value',
      value: formatCurrency(kpis.activeListingsValue),
      subtitle: `${kpis.activeListingsCount} properties on market`,
      Icon: Building2,
      color: 'red' as const,
    },
    {
      label: 'Active Listings Fee',
      value: formatCurrency(kpis.activeListingsFee),
      subtitle: 'Expected fees from current listings',
      Icon: DollarSign,
      color: 'red' as const,
    },
    {
      label: 'Forecast Fees (Month)',
      value: formatCurrency(kpis.forecastFeesMonth),
      subtitle: 'Settlements due this month',
      Icon: TrendingUp,
      color: 'amber' as const,
    },
    {
      label: 'Forecast Fees (Quarter)',
      value: formatCurrency(kpis.forecastFeesQuarter),
      subtitle: 'Settlements due this quarter',
      Icon: TrendingUp,
      color: 'amber' as const,
    },
    {
      label: 'Settled Fees YTD',
      value: formatCurrency(kpis.settledFeesYTD),
      subtitle: 'Invoiced & settled this calendar year',
      Icon: CheckCircle,
      color: 'green' as const,
    },
    {
      label: 'Active Submissions',
      value: kpis.activeSubmissions.toLocaleString(),
      subtitle: 'WIP deals at Submission stage',
      Icon: FileText,
      color: 'grey' as const,
    },
    {
      label: 'Active Listings Count',
      value: kpis.activeListingsCount.toLocaleString(),
      subtitle: 'Properties currently listed',
      Icon: LayoutList,
      color: 'grey' as const,
    },
  ]

  return (
    <>
      <Header title="Dashboard" subtitle="— Investment Sales NSW Overview" />
      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-7xl mx-auto space-y-10">

          {/* KPI Grid */}
          <section>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
              Key Metrics
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {kpiCards.map(card => (
                <KPICard key={card.label} {...card} />
              ))}
            </div>
          </section>

          {/* Charts */}
          <section>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
              Analytics
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              <ChartCard title="Fees by Agent" subtitle="Settled vs forecast from Fee Forecast">
                <FeesByAgentChart data={agentFeeData} />
              </ChartCard>

              <ChartCard title="Fees by Month" subtitle="Settlement schedule (area = volume)">
                <FeesByMonthChart data={feesByMonthData} />
              </ChartCard>

              <ChartCard title="WIP by Status" subtitle={`${wip.length} total pipeline deals`}>
                <WIPByStatusChart data={wipByStatusData} />
              </ChartCard>

              <ChartCard title="Active Listings by Asset Class" subtitle={`${listings.length} listings`}>
                <ListingsByAssetClassChart data={listingsByAssetClassData} />
              </ChartCard>

              <ChartCard
                title="Pipeline by Rating"
                subtitle="Deal count by CW rating tier"
                className="lg:col-span-2"
              >
                <PipelineByRatingChart data={pipelineByRatingData} />
              </ChartCard>

            </div>
          </section>

        </div>
      </main>
    </>
  )
}

function ChartCard({
  title,
  subtitle,
  children,
  className = '',
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-6 ${className}`}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}
