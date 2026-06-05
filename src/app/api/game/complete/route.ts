import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { updateStreak, freezesEarned } from '@/lib/streak'
import { computeNewBadges, type GameSummary } from '@/lib/badges'

interface CellPayload {
  rarity: number
  points: number
  playerName: string
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await request.json() as {
    score: number
    filled: number
    sport: string
    cellResults: CellPayload[]
  }

  const db = createAdminClient()

  // Load current profile stats.
  const { data: profile } = await db
    .from('profiles')
    .select('stats, badges, streak_freezes')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'profile not found' }, { status: 404 })

  const stats = (profile.stats ?? {}) as Record<string, unknown>
  const existingBadges = (profile.badges ?? []) as string[]

  // Streak update.
  const streakState = {
    streak: (stats.streak as number) ?? 0,
    longestStreak: (stats.longestStreak as number) ?? 0,
    streakFreezes: (profile.streak_freezes as number) ?? 0,
    lastPlayedDate: (stats.lastPlayedDate as string) ?? null,
  }
  const streakUpdate = updateStreak(streakState)

  // Grids completed (only count if not already played today).
  const prevCompleted = (stats.gridsCompleted as number) ?? 0
  const gridsCompleted = streakUpdate.alreadyPlayedToday
    ? prevCompleted
    : prevCompleted + 1

  // Freeze grants (every 7 grids).
  const newFreezes = freezesEarned(prevCompleted, gridsCompleted)

  // Fetch team counts for journeyman badge detection.
  const names = body.cellResults.map((c) => c.playerName)
  const { data: playerRows } = await db
    .from('players')
    .select('name, teams')
    .in('name', names)
    .eq('sport', body.sport)
  const teamCountByName = Object.fromEntries(
    (playerRows ?? []).map((p) => [p.name as string, (p.teams as string[]).length])
  )

  // Build game summary for badge computation.
  const summary: GameSummary = {
    score: body.score,
    filled: body.filled,
    sport: body.sport,
    streak: streakUpdate.streak,
    gridsCompleted,
    cellResults: body.cellResults.map((c) => ({
      rarity: c.rarity,
      points: c.points,
      basePoints: 100 - c.rarity,
      teamCount: teamCountByName[c.playerName] ?? 0,
    })),
  }
  const newBadges = computeNewBadges(existingBadges, summary)

  // Update sport breakdown.
  const sportBreakdown = ((stats.sportBreakdown as Record<string, number>) ?? { nba: 0, soccer: 0 })
  if (!streakUpdate.alreadyPlayedToday) {
    sportBreakdown[body.sport] = (sportBreakdown[body.sport] ?? 0) + 1
  }

  // Persist everything.
  const updatedStats = {
    ...stats,
    gridsCompleted,
    streak: streakUpdate.streak,
    longestStreak: streakUpdate.longestStreak,
    lastPlayedDate: streakUpdate.lastPlayedDate,
    bestScore: Math.max((stats.bestScore as number) ?? 0, body.score),
    sportBreakdown,
  }

  await db.from('profiles').update({
    stats: updatedStats,
    badges: [...existingBadges, ...newBadges],
    streak_freezes: streakUpdate.streakFreezes + newFreezes,
  }).eq('id', user.id)

  return NextResponse.json({
    streak: streakUpdate.streak,
    longestStreak: streakUpdate.longestStreak,
    usedFreeze: streakUpdate.usedFreeze,
    alreadyPlayedToday: streakUpdate.alreadyPlayedToday,
    newBadges,
    streakFreezes: streakUpdate.streakFreezes + newFreezes,
    gridsCompleted,
  })
}
