'use client'

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function RefreshTime() {
  const [time, setTime] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const fmt = () =>
      new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
    setTime(fmt())
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    router.refresh()
    await new Promise(r => setTimeout(r, 600))
    setTime(new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }))
    setRefreshing(false)
  }

  if (!time) return null

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-400">Data as of {time}</span>
      <button
        onClick={handleRefresh}
        title="Reload data from spreadsheet"
        className="text-gray-400 hover:text-cw-red transition-colors"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
      </button>
    </div>
  )
}
