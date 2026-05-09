import { NextRequest, NextResponse } from 'next/server'
import { readAgents, addAgent } from '@/lib/agents'

export async function GET() {
  return NextResponse.json({ agents: readAgents() })
}

export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json()
    const result = addAgent(name)
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ agent: result.agent }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
