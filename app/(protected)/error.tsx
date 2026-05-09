'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Page Error]', error)
  }, [error])

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <AlertTriangle className="w-8 h-8 text-cw-red" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Something went wrong</h2>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          {error.message?.includes('ENOENT')
            ? 'The data file could not be read. Check that workbook.xlsx exists in the data/ folder.'
            : error.message || 'An unexpected error occurred loading this page.'}
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-cw-red hover:bg-cw-red-dark text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Try again
        </button>
      </div>
    </div>
  )
}
