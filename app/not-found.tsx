import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="fixed top-0 left-0 right-0 h-1 bg-cw-red" />
      <div className="text-center">
        <p className="text-8xl font-bold text-gray-100 select-none mb-2">404</p>
        <h1 className="text-xl font-semibold text-gray-800 mb-2">Page not found</h1>
        <p className="text-sm text-gray-500 mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center px-5 py-2.5 bg-cw-red hover:bg-cw-red-dark text-white text-sm font-semibold rounded-lg transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>
      <p className="absolute bottom-6 text-xs text-gray-400">
        Cushman &amp; Wakefield Investment Sales NSW
      </p>
    </div>
  )
}
