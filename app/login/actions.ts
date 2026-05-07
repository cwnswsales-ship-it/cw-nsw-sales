'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createHash } from 'crypto'

export type LoginState = { error: string } | null

function buildToken(password: string): string {
  return createHash('sha256')
    .update(`cw-wip-auth:${password}`)
    .digest('hex')
}

export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const password = (formData.get('password') as string) ?? ''
  const appPassword = process.env.APP_PASSWORD

  if (!appPassword) {
    return { error: 'Server configuration error. Please contact your administrator.' }
  }

  if (password !== appPassword) {
    return { error: 'Incorrect password. Please try again.' }
  }

  const token = buildToken(appPassword)
  const cookieStore = await cookies()
  cookieStore.set('cw-auth', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  })

  redirect('/dashboard')
}
