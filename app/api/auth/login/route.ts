import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'

function generateToken(password: string, secret: string): string {
  return createHmac('sha256', secret).update(password).digest('hex')
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { password } = body

    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Password required' }, { status: 400 })
    }

    const expectedPassword = process.env.APP_PASSWORD || 'changeme'

    if (password !== expectedPassword) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
    }

    const secret = process.env.AUTH_SECRET || 'cw-wip-secret-2024'
    const token = generateToken(password, secret)

    const response = NextResponse.json({ success: true })
    response.cookies.set('cw_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    return response
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
