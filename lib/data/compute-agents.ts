import type { WIPRow, ForecastRow } from './types'
import type { Agent } from '../agents'

export interface AgentPerformance {
  agent: Agent
  initials: string
  /** Fees from settled forecast rows (exact splits) */
  settledFee: number
  /** Fees from unsettled forecast rows (exact splits) */
  forecastFee: number
  totalFee: number
  /** Deals where this agent appears as agent1/2/3 in WIP */
  wipDeals: number
  /** Sum of values for those WIP deals */
  wipValue: number
  /** Forecast rows where this agent has a non-zero split */
  forecastDeals: number
  avgFee: number
  /** 0–100 */
  shareOfTotal: number
}

export function computeAgentPerformance(
  agents: Agent[],
  wip: WIPRow[],
  forecast: ForecastRow[]
): AgentPerformance[] {
  const results: AgentPerformance[] = agents.map(agent => {
    let settledFee = 0
    let forecastFee = 0
    let forecastDeals = 0

    if (agent.forecastKey) {
      for (const row of forecast) {
        const val = (row[agent.forecastKey as keyof ForecastRow] as number | null) ?? 0
        if (val > 0) {
          forecastDeals++
          if (row.status === 'Settled') settledFee += val
          else forecastFee += val
        }
      }
    }

    const wipRows = wip.filter(
      r => r.agent1 === agent.name || r.agent2 === agent.name || r.agent3 === agent.name
    )

    const totalFee = settledFee + forecastFee
    const initials = agent.name
      .split(' ')
      .map(w => w[0] ?? '')
      .join('')
      .toUpperCase()
      .slice(0, 2)

    return {
      agent,
      initials,
      settledFee,
      forecastFee,
      totalFee,
      wipDeals: wipRows.length,
      wipValue: wipRows.reduce((s, r) => s + (r.value ?? 0), 0),
      forecastDeals,
      avgFee: forecastDeals > 0 ? totalFee / forecastDeals : 0,
      shareOfTotal: 0,
    }
  })

  const totalAllFees = results.reduce((s, r) => s + r.totalFee, 0)
  return results.map(r => ({
    ...r,
    shareOfTotal: totalAllFees > 0 ? (r.totalFee / totalAllFees) * 100 : 0,
  }))
}
