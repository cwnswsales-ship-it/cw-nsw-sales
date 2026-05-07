'use client'

import { useActionState } from 'react'
import { loginAction } from './actions'
import { Eye, EyeOff, Lock } from 'lucide-react'
import { useState } from 'react'

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, null)
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12"
        style={{ backgroundColor: '#0C2340' }}
      >
        {/* Logo */}
        <div>
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded flex items-center justify-center font-bold text-white text-sm"
              style={{ backgroundColor: '#00A650' }}
            >
              C&W
            </div>
            <span className="text-white font-semibold text-sm tracking-wide">
              CUSHMAN & WAKEFIELD
            </span>
          </div>
        </div>

        {/* Hero text */}
        <div>
          <h1 className="text-white text-5xl font-bold leading-tight mb-4">
            Investment Sales<br />NSW Pipeline
          </h1>
          <p className="text-white/60 text-lg leading-relaxed max-w-sm">
            A unified view of your WIP, active listings, fee forecasts,
            and agent performance — all in one place.
          </p>

          {/* Feature bullets */}
          <div className="mt-10 space-y-3">
            {[
              'Real-time WIP pipeline tracking',
              'Active listings with close date visibility',
              'Fee forecasting by agent and quarter',
              'Agent performance and split reporting',
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-3">
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: '#00A650' }}
                />
                <span className="text-white/70 text-sm">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-white/30 text-xs">
          © {new Date().getFullYear()} Cushman & Wakefield · Internal Use Only
        </p>
      </div>

      {/* Right panel — form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div
              className="w-7 h-7 rounded flex items-center justify-center font-bold text-white text-xs"
              style={{ backgroundColor: '#00A650' }}
            >
              C&W
            </div>
            <span className="font-semibold text-sm tracking-wide" style={{ color: '#0C2340' }}>
              CUSHMAN & WAKEFIELD
            </span>
          </div>

          <h2 className="text-2xl font-bold mb-1" style={{ color: '#0C2340' }}>
            Welcome back
          </h2>
          <p className="text-slate-500 text-sm mb-8">
            Sign in to access the WIP dashboard
          </p>

          <form action={formAction} className="space-y-4">
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="w-4 h-4 text-slate-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className="w-full pl-10 pr-10 py-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                  style={{ '--tw-ring-color': '#00A650' } as React.CSSProperties}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {state?.error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-lg">
                <span className="font-medium">{state.error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-3 rounded-lg text-white font-semibold text-sm transition-opacity disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-offset-2"
              style={{ backgroundColor: '#00A650' }}
            >
              {isPending ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-slate-400 text-xs mt-8">
            Internal use only · Contact your administrator for access
          </p>
        </div>
      </div>
    </div>
  )
}
