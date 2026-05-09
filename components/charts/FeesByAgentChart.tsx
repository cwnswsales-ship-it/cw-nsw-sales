'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { AgentFeeItem } from '@/lib/data/compute-kpis'

interface Props {
  data: AgentFeeItem[]
}

function fmtAUD(v: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(v)
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-800 mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.fill }} />
          <span className="text-gray-600">{p.name}:</span>
          <span className="font-medium text-gray-900">{fmtAUD(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function FeesByAgentChart({ data }: Props) {
  if (!data.length) return <EmptyState />
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
        <XAxis dataKey="agent" tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} />
        <YAxis
          tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
          tick={{ fontSize: 11, fill: '#9CA3AF' }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F9FAFB' }} />
        <Legend wrapperStyle={{ fontSize: 12, color: '#6B7280' }} />
        <Bar dataKey="settled" name="Settled" fill="#00875A" radius={[3, 3, 0, 0]} />
        <Bar dataKey="forecast" name="Forecast" fill="#C8102E" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function EmptyState() {
  return (
    <div className="h-60 flex items-center justify-center text-sm text-gray-400">
      No agent fee data available
    </div>
  )
}
