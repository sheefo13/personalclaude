import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateGrid, type PlayerLite } from '@/lib/grid'

export function todayString(): string {
  // UTC date as the daily key. (Spec's 9am-ET reset is a later refinement.)
  return new Date().toISOString().slice(0, 10)
}

export async function getNbaPlayers(): Promise<PlayerLite[]> {
  const db = createAdminClient()
  const { data } = await db
    .from('players')
    .select('name, teams, rarity')
    .eq('sport', 'nba')
  return (data as PlayerLite[]) ?? []
}

export async function getOrCreateTodayGrid(): Promise<{
  colTeams: string[]
  rowTeams: string[]
} | null> {
  const db = createAdminClient()
  const date = todayString()

  const { data: existing } = await db
    .from('grid_schedules')
    .select('col_teams, row_teams')
    .eq('date', date)
    .eq('sport', 'nba')
    .maybeSingle()

  if (existing) {
    return { colTeams: existing.col_teams, rowTeams: existing.row_teams }
  }

  const players = await getNbaPlayers()
  const generated = generateGrid(players)
  if (!generated) return null

  await db.from('grid_schedules').insert({
    date,
    sport: 'nba',
    col_teams: generated.colTeams,
    row_teams: generated.rowTeams,
    status: 'live',
  })

  return generated
}
