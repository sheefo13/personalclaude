import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getNbaPlayers, todayString } from '@/lib/game-server'
import { generateGrid } from '@/lib/grid'

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const qp = new URL(request.url).searchParams.get('secret')
  return request.headers.get('authorization') === `Bearer ${secret}` || qp === secret
}

// Admin helper: deletes today's NBA grid and builds a fresh one from the
// current player pool. Handy after a big data import.
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const db = createAdminClient()
  const date = todayString()

  await db.from('grid_schedules').delete().eq('date', date).eq('sport', 'nba')

  const players = await getNbaPlayers()
  const generated = generateGrid(players)
  if (!generated) {
    return NextResponse.json({ ok: false, error: 'could not generate a valid grid' }, { status: 500 })
  }

  await db.from('grid_schedules').insert({
    date,
    sport: 'nba',
    col_teams: generated.colTeams,
    row_teams: generated.rowTeams,
    status: 'live',
  })

  return NextResponse.json({ ok: true, ...generated })
}
