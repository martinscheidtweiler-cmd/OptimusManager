import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export async function POST(req: NextRequest) {
  const authorization = req.headers.get('authorization') || ''
  if (!authorization.startsWith('Bearer ')) return NextResponse.json({ error: 'Login vereist' }, { status: 401 })
  try {
    const payload = await req.text()
    if (payload.length > 12000) return NextResponse.json({ error: 'Opdracht te lang' }, { status: 413 })
    const upstream = await fetch('https://rqcjcikemgcqcgxltjfe.supabase.co/functions/v1/optimus-tasks/api/parse', {
      method: 'POST', headers: { Authorization: authorization, 'Content-Type': 'application/json' },
      body: payload, cache: 'no-store'
    })
    const json = await upstream.json().catch(() => ({ error: 'Geen antwoord van AI' }))
    return NextResponse.json(json, { status: upstream.status, headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'AI-service niet beschikbaar' }, { status: 502 })
  }
}
