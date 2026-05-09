import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

async function generateToken(password: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(password))
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

const PROTECTED_PATHS = ['/dashboard', '/wip', '/listings', '/forecast', '/agents']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sessionCookie = request.cookies.get('cw_session')?.value
  const password = process.env.APP_PASSWORD || 'changeme'
  const secret = process.env.AUTH_SECRET || 'cw-wip-secret-2024'

  // Redirect authenticated users away from login
  if (pathname === '/login' && sessionCookie) {
    const expectedToken = await generateToken(password, secret)
    if (sessionCookie === expectedToken) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  const isProtected = PROTECTED_PATHS.some(p => pathname.startsWith(p))
  if (!isProtected) return NextResponse.next()

  if (!sessionCookie) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const expectedToken = await generateToken(password, secret)

  if (sessionCookie !== expectedToken) {
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete('cw_session')
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/wip/:path*',
    '/listings/:path*',
    '/forecast/:path*',
    '/agents/:path*',
    '/login',
  ],
}
