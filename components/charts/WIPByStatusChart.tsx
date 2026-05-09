'use client'

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { StatusItem } from '@/lib/data/compute-kpis'

interface Props {
  data: StatusItem[]
}

const STATUS_COLORS: Record<string, string> = {
  'Exchanged': '#00875A',
  'Active Listing': '#2563EB',
  'Submission': '#F59E0B',
  'Appraisal': '#8B5CF6',
  'Pending': '#0891B2',
  'Lost': '#9CA3AF',
  'Withdrawn': '#D1D5DB',
  'Unknown': '#E5E7EB',
}

const FALLBACK_COLORS = ['#C8102E', '#2563EB', '#00875A', '#F59E0B', '#8B5CF6', '#0891B2']

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-800">{d.name}</p>
      <p className="text-gray-600 mt-1">Count: <span className="font-medium text-gray-900">{d.payload.count}</span></p>
    </div>
  )
}

const renderLegend = (props: any) => {
  const { payload } = props
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center mt-3">
      {payload.map((entry: any) => (
        <li key={entry.value} className="flex items-center gap-1.5 text-xs text-gray-600">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: entry.color }} />
          {entry.value}
        </li>
      ))}
    </ul>
  )
}

export default function WIPByStatusChart({ data }: Props) {
  if (!data.length) return <EmptyState />
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="45%"
          innerRadius={55}
          outerRadius={90}
          dataKey="count"
          nameKey="status"
          paddingAngle={2}
        >
          {data.map((entry, i) => (
            <Cell
              key={entry.status}
              fill={STATUS_COLORS[entry.status] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length]}
              stroke="none"
            />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend content={renderLegend} />
      </PieChart>
    </ResponsiveContainer>
  )
}

function EmptyState() {
  return (
    <div className="h-60 flex items-center justify-center text-sm text-gray-400">
      No WIP data available
    </div>
  )
}
