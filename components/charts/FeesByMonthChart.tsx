'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { MonthFeeItem } from '@/lib/data/compute-kpis'

interface Props {
  data: MonthFeeItem[]
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

export default function FeesByMonthChart({ data }: Props) {
  if (!data.length) return <EmptyState />
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <defs>
          <linearGradient id="settledGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#00875A" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#00875A" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#C8102E" stopOpacity={0.12} />
            <stop offset="95%" stopColor="#C8102E" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
        <YAxis
          tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
          tick={{ fontSize: 11, fill: '#9CA3AF' }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12, color: '#6B7280' }} />
        <Area
          type="monotone"
          dataKey="settled"
          name="Settled"
          stroke="#00875A"
          strokeWidth={2}
          fill="url(#settledGrad)"
        />
        <Area
          type="monotone"
          dataKey="forecast"
          name="Forecast"
          stroke="#C8102E"
          strokeWidth={2}
          fill="url(#forecastGrad)"
          strokeDasharray="4 3"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function EmptyState() {
  return (
    <div className="h-60 flex items-center justify-center text-sm text-gray-400">
      No monthly fee data available
    </div>
  )
}
