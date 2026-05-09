import fs from 'fs'
import path from 'path'

export interface Agent {
  id: string
  name: string
  /** Matches a property key on ForecastRow. Null for agents not in the spreadsheet. */
  forecastKey: string | null
}

const FILE = path.join(process.cwd(), 'data', 'agents.json')

const DEFAULTS: Agent[] = [
  { id: 'miron-solomons',  name: 'Miron Solomons',  forecastKey: 'mironSolomons'  },
  { id: 'matt-pontey',     name: 'Matt Pontey',      forecastKey: 'mattPontey'     },
  { id: 'henry-robertson', name: 'Henry Robertson',  forecastKey: 'henryRobertson' },
  { id: 'jake-smith',      name: 'Jake Smith',        forecastKey: 'jakeSmith'      },
]

export function readAgents(): Agent[] {
  try {
    if (!fs.existsSync(FILE)) {
      writeAgents(DEFAULTS)
      return DEFAULTS
    }
    const parsed = JSON.parse(fs.readFileSync(FILE, 'utf-8'))
    return Array.isArray(parsed.agents) ? parsed.agents : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

export function writeAgents(agents: Agent[]): void {
  fs.writeFileSync(FILE, JSON.stringify({ agents }, null, 2))
}

export function addAgent(name: string): { agent: Agent; error?: string } {
  const agents = readAgents()
  const trimmed = name.trim()
  if (!trimmed) return { agent: DEFAULTS[0], error: 'Name is required' }
  if (agents.some(a => a.name.toLowerCase() === trimmed.toLowerCase())) {
    return { agent: DEFAULTS[0], error: 'Agent already exists' }
  }
  const id = trimmed.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const agent: Agent = { id: `${id}-${Date.now()}`, name: trimmed, forecastKey: null }
  writeAgents([...agents, agent])
  return { agent }
}

export function removeAgent(id: string): void {
  writeAgents(readAgents().filter(a => a.id !== id))
}
