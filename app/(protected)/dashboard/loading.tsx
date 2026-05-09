import { Skeleton } from '@/components/ui/Skeleton'

function HeaderSkeleton() {
  return (
    <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between flex-shrink-0">
      <div>
        <Skeleton className="h-3 w-40 mb-1.5" />
        <Skeleton className="h-5 w-32" />
      </div>
      <Skeleton className="h-8 w-24 rounded-lg" />
    </div>
  )
}

function KPICardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4">
      <Skeleton className="w-10 h-10 rounded-lg flex-shrink-0" />
      <div className="flex-1">
        <Skeleton className="h-3 w-24 mb-2.5" />
        <Skeleton className="h-6 w-28 mb-2" />
        <Skeleton className="h-3 w-36" />
      </div>
    </div>
  )
}

function ChartSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-6 ${wide ? 'lg:col-span-2' : ''}`}>
      <Skeleton className="h-4 w-36 mb-1.5" />
      <Skeleton className="h-3 w-48 mb-5" />
      <Skeleton className="h-52 w-full rounded-lg" />
    </div>
  )
}

export default function DashboardLoading() {
  return (
    <>
      <HeaderSkeleton />
      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-7xl mx-auto space-y-10">

          {/* KPI section */}
          <section>
            <Skeleton className="h-3 w-24 mb-4" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 9 }).map((_, i) => <KPICardSkeleton key={i} />)}
            </div>
          </section>

          {/* Charts section */}
          <section>
            <Skeleton className="h-3 w-20 mb-4" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <ChartSkeleton />
              <ChartSkeleton />
              <ChartSkeleton />
              <ChartSkeleton />
              <ChartSkeleton wide />
            </div>
          </section>

        </div>
      </main>
    </>
  )
}
