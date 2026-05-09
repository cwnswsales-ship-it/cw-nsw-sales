'use client'

import { useRouter } from 'next/navigation'
import { LogOut, ChevronRight } from 'lucide-react'

interface HeaderProps {
  title: string
  subtitle?: string
  children?: React.ReactNode
}

export default function Header({ title, subtitle, children }: HeaderProps) {
  const router = useRouter()

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between flex-shrink-0">
      <div>
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-0.5">
          <span>Investment Sales NSW</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-gray-600">{title}</span>
        </div>
        <h1 className="text-lg font-semibold text-gray-900 leading-tight">
          {title}
          {subtitle && (
            <span className="ml-2 text-sm font-normal text-gray-500">{subtitle}</span>
          )}
        </h1>
      </div>

      <div className="flex items-center gap-5">
        {children}
        <div className="text-right hidden sm:block">
          <p className="text-xs font-medium text-gray-700">CW Investment Sales</p>
          <p className="text-xs text-gray-400">NSW Team</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-cw-red transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  )
}
