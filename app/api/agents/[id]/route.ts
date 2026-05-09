import { NextResponse } from 'next/server'
import { removeAgent } from '@/lib/agents'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  removeAgent(id)
  return NextResponse.json({ success: true })
}
