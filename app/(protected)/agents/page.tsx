import Header from '@/components/layout/Header'
import { Users } from 'lucide-react'

export default function AgentsPage() {
  return (
    <>
      <Header title="Agent Performance" />
      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-xl border border-gray-200 p-16 flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center">
              <Users className="w-8 h-8 text-gray-400" />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-gray-700">Agent Performance</p>
              <p className="text-sm text-gray-400 mt-1">
                Fee splits &amp; agent breakdown — coming in Stage 5
              </p>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
