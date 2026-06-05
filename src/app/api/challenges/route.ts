import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { todayString } from '@/lib/game-server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { score, sport } = await req.json()
  if (typeof score !== 'number' || !sport) {
    return NextResponse.json({ error: 'Missing score or sport' }, { status: 400 })
  }

  const code = Math.random().toString(36).slice(2, 8).toUpperCase()
  const grid_date = todayString()

  const admin = createAdminClient()

  // Get challenger username
  const { data: profile } = await admin
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .single()

  const { error } = await admin.from('challenges').insert({
    code,
    grid_date,
    sport,
    challenger_id: user.id,
    challenger_score: score,
    responses: [],
  })

  if (error) {
    console.error('Challenge insert error:', error)
    return NextResponse.json({ error: 'Failed to create challenge' }, { status: 500 })
  }

  const url = `https://gridlore.vercel.app/challenge/${code}`
  return NextResponse.json({ code, url, challengerUsername: profile?.username })
}
