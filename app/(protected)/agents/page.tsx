import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Agent Performance | CW WIP' }
import Header from '@/components/layout/Header'
import AgentCard from '@/components/agents/AgentCard'
import AgentManager from '@/components/agents/AgentManager'
import { getWIPData, getForecastData, formatCurrency } from '@/lib/data'
import { readAgents } from '@/lib/agents'
import { computeAgentPerformance } from '@/lib/data/compute-agents'

export const dynamic = 'force-dynamic'

export default async function AgentsPage() {
  const [wip, forecast, agents] = await Promise.all([
    getWIPData(),
    getForecastData(),
    Promise.resolve(readAgents()),
  ])

  const performance = computeAgentPerformance(agents, wip, forecast)
  const totalFees = performance.reduce((s, p) => s + p.totalFee, 0)
  const totalSettled = performance.reduce((s, p) => s + p.settledFee, 0)
  const totalForecast = performance.reduce((s, p) => s + p.forecastFee, 0)

  return (
    <>
      <Header title="Agent Performance" subtitle={`— ${agents.length} agents`} />
      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* Summary bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Agents',    value: agents.length.toString() },
              { label: 'Total Fees',      value: formatCurrency(totalFees) },
              { label: 'Settled',         value: formatCurrency(totalSettled) },
              { label: 'Forecast',        value: formatCurrency(totalForecast) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-200 px-5 py-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
                <p className="text-xl font-bold text-gray-900">{value}</p>
              </div>
            ))}
          </div>

          {/* Agent manager */}
          <AgentManager agents={agents} />

          {/* Performance cards */}
          {performance.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {performance
                .sort((a, b) => b.totalFee - a.totalFee)
                .map((perf, i) => (
                  <AgentCard key={perf.agent.id} perf={perf} index={i} />
                ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
              <p className="text-gray-500 font-medium">No agents yet</p>
              <p className="text-sm text-gray-400 mt-1">Add agents above to see their performance metrics.</p>
            </div>
          )}

        </div>
      </main>
    </>
  )
}
