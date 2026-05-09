'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import type { AssetClassItem } from '@/lib/data/compute-kpis'

interface Props {
  data: AssetClassItem[]
}

const COLORS = ['#C8102E', '#2563EB', '#00875A', '#F59E0B', '#8B5CF6', '#0891B2', '#F97316']

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-800 mb-1">{label}</p>
      <p className="text-gray-600">Listings: <span className="font-medium text-gray-900">{d.value}</span></p>
    </div>
  )
}

export default function ListingsByAssetClassChart({ data }: Props) {
  if (!data.length) return <EmptyState />
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: '#9CA3AF' }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="assetClass"
          tick={{ fontSize: 11, fill: '#6B7280' }}
          axisLine={false}
          tickLine={false}
          width={130}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F9FAFB' }} />
        <Bar dataKey="count" name="Listings" radius={[0, 3, 3, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function EmptyState() {
  return (
    <div className="h-60 flex items-center justify-center text-sm text-gray-400">
      No listings data available
    </div>
  )
}
