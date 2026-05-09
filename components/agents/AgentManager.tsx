'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, AlertCircle, Info } from 'lucide-react'

interface Agent {
  id: string
  name: string
  forecastKey: string | null
}

export default function AgentManager({ agents }: { agents: Agent[] }) {
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [removing, setRemoving] = useState<string | null>(null)
  const router = useRouter()

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setAdding(true)
    setError('')
    const res = await fetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    })
    const data = await res.json()
    if (res.ok) {
      setNewName('')
      router.refresh()
    } else {
      setError(data.error ?? 'Failed to add agent')
    }
    setAdding(false)
  }

  const handleRemove = async (id: string, name: string) => {
    if (!confirm(`Remove ${name}?\n\nTheir data remains in the spreadsheet — this only removes them from the performance view.`)) return
    setRemoving(id)
    await fetch(`/api/agents/${id}`, { method: 'DELETE' })
    router.refresh()
    setRemoving(null)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-800">Agent Roster</h2>
        <span className="text-xs text-gray-400">{agents.length} agents</span>
      </div>

      {/* Current agents */}
      <div className="flex flex-wrap gap-2 mb-4">
        {agents.map(agent => (
          <div
            key={agent.id}
            className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg pl-3 pr-2 py-1.5 group"
          >
            <span className="text-sm font-medium text-gray-700">{agent.name}</span>
            {!agent.forecastKey && (
              <span
                title="This agent isn't in the Fee Forecast sheet — WIP deal counts only"
                className="text-xs text-gray-400 italic"
              >
                (WIP only)
              </span>
            )}
            <button
              onClick={() => handleRemove(agent.id, agent.name)}
              disabled={removing === agent.id}
              title={`Remove ${agent.name}`}
              className="text-gray-300 hover:text-cw-red transition-colors disabled:opacity-40 ml-0.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Add form */}
      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          value={newName}
          onChange={e => { setNewName(e.target.value); setError('') }}
          placeholder="New agent full name…"
          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cw-red/20 focus:border-cw-red"
        />
        <button
          type="submit"
          disabled={adding || !newName.trim()}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-cw-red hover:bg-cw-red-dark rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Add Agent
        </button>
      </form>

      {error && (
        <p className="flex items-center gap-1.5 mt-2 text-sm text-red-600">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {error}
        </p>
      )}

      <p className="flex items-start gap-1.5 mt-3 text-xs text-gray-400">
        <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
        Agents with a matching column in the Fee Forecast sheet show exact fee splits. New agents show WIP deal counts only.
      </p>
    </div>
  )
}
