import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  label: string
  value: string
  subtitle?: string
  Icon: LucideIcon
  color?: 'red' | 'green' | 'blue' | 'amber' | 'grey'
}

const colorMap = {
  red:   'bg-red-50 text-cw-red',
  green: 'bg-cw-green-light text-cw-green',
  blue:  'bg-blue-50 text-blue-600',
  amber: 'bg-amber-50 text-amber-600',
  grey:  'bg-gray-100 text-gray-500',
}

export default function KPICard({ label, value, subtitle, Icon, color = 'blue' }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4 hover:shadow-sm transition-shadow">
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', colorMap[color])}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 leading-none">
          {label}
        </p>
        <p className="text-[22px] font-bold text-gray-900 leading-none tracking-tight">
          {value}
        </p>
        {subtitle && (
          <p className="text-xs text-gray-400 mt-1.5">{subtitle}</p>
        )}
      </div>
    </div>
  )
}
