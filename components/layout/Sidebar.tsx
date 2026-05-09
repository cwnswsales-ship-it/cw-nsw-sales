'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  ClipboardList,
  Building2,
  TrendingUp,
  Users,
} from 'lucide-react'

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/wip', label: 'WIP', icon: ClipboardList },
  { href: '/listings', label: 'Active Listings', icon: Building2 },
  { href: '/forecast', label: 'Fee Forecast', icon: TrendingUp },
  { href: '/agents', label: 'Agent Performance', icon: Users },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 bg-gray-900 min-h-screen flex flex-col flex-shrink-0">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-cw-red rounded-md flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="text-white font-bold text-sm tracking-tight">CW</span>
          </div>
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm leading-tight truncate">
              Cushman &amp; Wakefield
            </p>
            <p className="text-gray-500 text-xs leading-tight">Investment Sales NSW</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 space-y-0.5">
        <p className="px-3 text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">
          Navigation
        </p>
        {nav.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href ||
            (href !== '/dashboard' && pathname.startsWith(href))

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-cw-red text-white shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-gray-800">
        <p className="text-gray-600 text-xs">WIP Dashboard v1.0</p>
        <p className="text-gray-700 text-xs mt-0.5">Internal use only</p>
      </div>
    </aside>
  )
}
