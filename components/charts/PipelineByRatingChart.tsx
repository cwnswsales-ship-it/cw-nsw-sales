'use client'

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { RatingItem } from '@/lib/data/compute-kpis'

interface Props {
  data: RatingItem[]
}

const RATING_COLORS: Record<string, string> = {
  'AAAA': '#00875A',
  'AAA':  '#2563EB',
  'AA':   '#F59E0B',
  'A':    '#8B5CF6',
  'Lost': '#9CA3AF',
}

function fmtAUD(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}k`
  return `$${v}`
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-800">{d.name}</p>
      <p className="text-gray-600 mt-1">Deals: <span className="font-medium text-gray-900">{d.payload.count}</span></p>
      <p className="text-gray-600">Value: <span className="font-medium text-gray-900">{fmtAUD(d.payload.value)}</span></p>
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

export default function PipelineByRatingChart({ data }: Props) {
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
          nameKey="rating"
          paddingAngle={2}
        >
          {data.map((entry, i) => (
            <Cell
              key={entry.rating}
              fill={RATING_COLORS[entry.rating] ?? '#E5E7EB'}
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
      No pipeline data available
    </div>
  )
}
