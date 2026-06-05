import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  const admin = createAdminClient()

  const { data: challenge, error } = await admin
    .from('challenges')
    .select('id, code, grid_date, sport, challenger_id, challenger_score, responses, created_at')
    .eq('code', code.toUpperCase())
    .single()

  if (error || !challenge) {
    return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
  }

  // Get challenger username
  const { data: profile } = await admin
    .from('profiles')
    .select('username')
    .eq('id', challenge.challenger_id)
    .single()

  return NextResponse.json({
    code: challenge.code,
    grid_date: challenge.grid_date,
    sport: challenge.sport,
    challenger_score: challenge.challenger_score,
    challenger_id: challenge.challenger_id,
    responses: challenge.responses ?? [],
    challengerUsername: profile?.username ?? 'Unknown',
    created_at: challenge.created_at,
  })
}
