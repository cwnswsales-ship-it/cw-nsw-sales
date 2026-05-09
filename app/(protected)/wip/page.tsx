import Header from '@/components/layout/Header'
import { ClipboardList } from 'lucide-react'

export default function WIPPage() {
  return (
    <>
      <Header title="WIP" subtitle="— Work In Progress" />
      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-xl border border-gray-200 p-16 flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center">
              <ClipboardList className="w-8 h-8 text-gray-400" />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-gray-700">WIP Table</p>
              <p className="text-sm text-gray-400 mt-1">
                Searchable &amp; filterable pipeline table — coming in Stage 4
              </p>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
