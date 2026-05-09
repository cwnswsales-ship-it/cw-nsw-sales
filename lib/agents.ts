import fs from 'fs'
import path from 'path'

export interface Agent {
  id: string
  name: string
  /** Matches a property key on ForecastRow. Null for agents not in the spreadsheet. */
  forecastKey: string | null
}

// Primary location (baked into the Docker image / local dev)
const PRIMARY = path.join(process.cwd(), 'data', 'agents.json')
// Writable fallback for platforms with a read-only project filesystem (Vercel, etc.)
// Changes written here are ephemeral (lost on cold start) but the app won't crash.
const TMP = '/tmp/cw-agents.json'

const DEFAULTS: Agent[] = [
  { id: 'miron-solomons',  name: 'Miron Solomons',  forecastKey: 'mironSolomons'  },
  { id: 'matt-pontey',     name: 'Matt Pontey',      forecastKey: 'mattPontey'     },
  { id: 'henry-robertson', name: 'Henry Robertson',  forecastKey: 'henryRobertson' },
  { id: 'jake-smith',      name: 'Jake Smith',        forecastKey: 'jakeSmith'      },
]

function parse(file: string): Agent[] | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'))
    return Array.isArray(parsed.agents) ? parsed.agents : null
  } catch {
    return null
  }
}

export function readAgents(): Agent[] {
  // Prefer /tmp if it has a newer agent list (user made changes this session)
  if (fs.existsSync(TMP)) {
    const tmp = parse(TMP)
    if (tmp) return tmp
  }
  if (fs.existsSync(PRIMARY)) {
    const primary = parse(PRIMARY)
    if (primary) return primary
  }
  return DEFAULTS
}

export function writeAgents(agents: Agent[]): void {
  const json = JSON.stringify({ agents }, null, 2)
  // Try primary location first (Docker / Railway / Render / local)
  try {
    fs.mkdirSync(path.dirname(PRIMARY), { recursive: true })
    fs.writeFileSync(PRIMARY, json)
    return
  } catch {
    // Primary is read-only (Vercel serverless, etc.) — fall back to /tmp
  }
  try {
    fs.writeFileSync(TMP, json)
  } catch (err) {
    console.warn('[agents] Could not persist agent list:', err)
  }
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
