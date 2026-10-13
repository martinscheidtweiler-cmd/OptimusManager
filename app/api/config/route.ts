import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export function GET() {
  return NextResponse.json({
    url: 'https://rqcjcikemgcqcgxltjfe.supabase.co',
    publishableKey: 'sb_publishable_SpkBPN3KoZRtGDSn11MfBw_jysgfMj-'
  }, { headers: { 'Cache-Control': 'no-store' } })
}
