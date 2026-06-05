import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function weekStart(): string {
  const d = new Date()
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().slice(0, 10)
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const currentWeekStart = weekStart()
  const currentSeasonMonth = new Date().toISOString().slice(0, 7)

  // Get all crews the user is in
  const { data: memberships, error: memberError } = await supabase
    .from('crew_members')
    .select('crew_id')
    .eq('user_id', user.id)

  if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 })
  if (!memberships?.length) return NextResponse.json({ crews: [], currentWeekStart, currentSeasonMonth })

  const crewIds = memberships.map((m) => m.crew_id)

  const { data: crews, error: crewError } = await supabase
    .from('crews')
    .select('id, name, invite_code, owner_id')
    .in('id', crewIds)

  if (crewError) return NextResponse.json({ error: crewError.message }, { status: 500 })

  // For each crew, get leaderboard data
  const crewsWithLeaderboards = await Promise.all(
    (crews ?? []).map(async (crew) => {
      const { data: scores } = await supabase
        .from('crew_scores')
        .select('user_id, weekly_score, season_score')
        .eq('crew_id', crew.id)
        .eq('week_start', currentWeekStart)
        .order('weekly_score', { ascending: false })

      // Get usernames for score entries
      const userIds = (scores ?? []).map((s) => s.user_id)
      let usernameMap: Record<string, string> = {}
      if (userIds.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username')
          .in('id', userIds)
        usernameMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.username]))
      }

      const leaderboard = (scores ?? []).map((s) => ({
        username: usernameMap[s.user_id] ?? 'Unknown',
        weekly_score: s.weekly_score,
        season_score: s.season_score,
      }))

      return { ...crew, leaderboard }
    })
  )

  return NextResponse.json({ crews: crewsWithLeaderboards, currentWeekStart, currentSeasonMonth })
}
