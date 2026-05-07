import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

async function buildToken(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(`cw-wip-auth:${password}`)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public paths — no auth required
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next()
  }

  const appPassword = process.env.APP_PASSWORD
  if (!appPassword) {
    // Mis-configured server — send to login so the error is visible
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const token = request.cookies.get('cw-auth')?.value
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const expected = await buildToken(appPassword)
  if (token !== expected) {
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete('cw-auth')
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
