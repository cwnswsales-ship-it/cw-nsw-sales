import { Skeleton } from '@/components/ui/Skeleton'

function AgentCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Skeleton className="w-11 h-11 rounded-full flex-shrink-0" />
          <div>
            <Skeleton className="h-4 w-32 mb-1.5" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="text-right">
          <Skeleton className="h-3 w-16 mb-1.5 ml-auto" />
          <Skeleton className="h-5 w-24" />
        </div>
      </div>
      {/* Share bar */}
      <div>
        <div className="flex justify-between mb-1.5">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-10" />
        </div>
        <Skeleton className="h-1.5 w-full rounded-full" />
      </div>
      {/* Metrics */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            <Skeleton className="h-3 w-20 mb-1" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AgentsLoading() {
  return (
    <>
      <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between flex-shrink-0">
        <div>
          <Skeleton className="h-3 w-40 mb-1.5" />
          <Skeleton className="h-5 w-40" />
        </div>
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>

      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* Summary bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 px-5 py-4">
                <Skeleton className="h-3 w-20 mb-2" />
                <Skeleton className="h-6 w-24" />
              </div>
            ))}
          </div>

          {/* Manager skeleton */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <Skeleton className="h-4 w-28 mb-4" />
            <div className="flex flex-wrap gap-2 mb-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-36 rounded-lg" />)}
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 flex-1" />
              <Skeleton className="h-9 w-28 rounded-lg" />
            </div>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {Array.from({ length: 4 }).map((_, i) => <AgentCardSkeleton key={i} />)}
          </div>

        </div>
      </main>
    </>
  )
}
