'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  FileText,
  Building2,
  TrendingUp,
  Users,
  LogOut,
} from 'lucide-react'
import { logoutAction } from '@/app/actions'
import { clsx } from 'clsx'

const NAV_ITEMS = [
  { label: 'Dashboard',         href: '/dashboard',                    icon: LayoutDashboard, exact: true },
  { label: 'WIP',               href: '/dashboard/wip',                icon: FileText,        exact: false },
  { label: 'Active Listings',   href: '/dashboard/active-listings',    icon: Building2,       exact: false },
  { label: 'Fee Forecast',      href: '/dashboard/fee-forecast',       icon: TrendingUp,      exact: false },
  { label: 'Agent Performance', href: '/dashboard/agent-performance',  icon: Users,           exact: false },
]

export default function Sidebar() {
  const pathname = usePathname()

  function isActive(href: string, exact: boolean) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  return (
    <aside
      className="w-60 flex flex-col flex-shrink-0 h-screen sticky top-0"
      style={{ backgroundColor: '#0C2340' }}
    >
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded flex items-center justify-center font-bold text-white text-[10px] flex-shrink-0"
            style={{ backgroundColor: '#00A650' }}
          >
            C&W
          </div>
          <div>
            <p className="text-white font-semibold text-xs tracking-wider leading-tight">
              CUSHMAN & WAKEFIELD
            </p>
            <p className="text-white/40 text-[10px] leading-tight mt-0.5">
              Investment Sales NSW
            </p>
          </div>
        </div>
        <p
          className="mt-3 text-[11px] font-semibold tracking-widest uppercase"
          style={{ color: '#00A650' }}
        >
          WIP Dashboard
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-thin">
        {NAV_ITEMS.map(({ label, href, icon: Icon, exact }) => {
          const active = isActive(href, exact)
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150',
                active
                  ? 'text-white font-medium'
                  : 'text-white/60 hover:text-white hover:bg-white/8',
              )}
              style={
                active
                  ? { backgroundColor: 'rgba(0,166,80,0.18)', color: '#ffffff' }
                  : undefined
              }
            >
              <Icon
                className="w-4 h-4 flex-shrink-0"
                style={active ? { color: '#00A650' } : undefined}
              />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer / Logout */}
      <div className="px-3 py-4 border-t border-white/10">
        <form action={logoutAction}>
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/8 transition-all duration-150"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            Sign Out
          </button>
        </form>
      </div>
    </aside>
  )
}
