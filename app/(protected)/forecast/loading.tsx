import { Skeleton } from '@/components/ui/Skeleton'

const COLS = 12

export default function ForecastLoading() {
  return (
    <>
      <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between flex-shrink-0">
        <div>
          <Skeleton className="h-3 w-40 mb-1.5" />
          <Skeleton className="h-5 w-52" />
        </div>
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>

      <main className="flex-1 overflow-auto p-8">
        <div className="space-y-4">
          {/* Quick stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 px-5 py-4">
                <Skeleton className="h-3 w-20 mb-2" />
                <Skeleton className="h-6 w-24" />
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex gap-3 flex-wrap">
              <Skeleton className="h-9 flex-1 min-w-48" />
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-9 w-32" />)}
              <Skeleton className="h-9 w-28 ml-auto" />
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {Array.from({ length: COLS }).map((_, i) => (
                    <th key={i} className="px-3 py-3 text-left">
                      <Skeleton className="h-3 w-14" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {Array.from({ length: 9 }).map((_, row) => (
                  <tr key={row}>
                    {Array.from({ length: COLS }).map((_, col) => (
                      <td key={col} className="px-3 py-2.5">
                        <Skeleton className={`h-4 ${col === 0 ? 'w-44' : col === 1 || col === 2 ? 'w-28' : 'w-20'}`} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  )
}
