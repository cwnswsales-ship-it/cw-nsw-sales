import { Skeleton } from '@/components/ui/Skeleton'

const COLS = 13

export default function WIPLoading() {
  return (
    <>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between flex-shrink-0">
        <div>
          <Skeleton className="h-3 w-40 mb-1.5" />
          <Skeleton className="h-5 w-48" />
        </div>
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>

      <main className="flex-1 overflow-auto p-8">
        <div className="space-y-4">
          {/* Filter bar */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex gap-3 flex-wrap">
              <Skeleton className="h-9 flex-1 min-w-48" />
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 w-32" />)}
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
                {Array.from({ length: 12 }).map((_, row) => (
                  <tr key={row}>
                    {Array.from({ length: COLS }).map((_, col) => (
                      <td key={col} className="px-3 py-2.5">
                        <Skeleton className={`h-4 ${col === 2 ? 'w-44' : col === 3 ? 'w-28' : col === 1 ? 'w-16' : 'w-20'}`} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
              <Skeleton className="h-3 w-64" />
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
