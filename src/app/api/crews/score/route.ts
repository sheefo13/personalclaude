import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

function weekStart(): string {
  const d = new Date()
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().slice(0, 10)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { score } = await req.json()
  if (typeof score !== 'number') return NextResponse.json({ error: 'Score required' }, { status: 400 })

  const currentWeekStart = weekStart()
  const currentSeasonMonth = new Date().toISOString().slice(0, 7)

  const { data: memberships } = await supabase
    .from('crew_members')
    .select('crew_id')
    .eq('user_id', user.id)

  if (!memberships?.length) return NextResponse.json({ updated: 0 })

  const admin = createAdminClient()
  let updated = 0

  for (const { crew_id } of memberships) {
    // Check existing score
    const { data: existing } = await admin
      .from('crew_scores')
      .select('weekly_score, season_score')
      .eq('crew_id', crew_id)
      .eq('user_id', user.id)
      .eq('week_start', currentWeekStart)
      .single()

    const newWeekly = existing ? Math.max(existing.weekly_score, score) : score
    const newSeason = existing ? Math.max(existing.season_score, score) : score

    await admin.from('crew_scores').upsert(
      {
        crew_id,
        user_id: user.id,
        week_start: currentWeekStart,
        weekly_score: newWeekly,
        season_month: currentSeasonMonth,
        season_score: newSeason,
      },
      { onConflict: 'crew_id,user_id,week_start' }
    )
    updated++
  }

  return NextResponse.json({ updated })
}
