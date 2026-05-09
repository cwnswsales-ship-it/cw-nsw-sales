import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Cushman & Wakefield | WIP',
  description: 'Investment Sales NSW — Work In Progress Dashboard',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  )
}
