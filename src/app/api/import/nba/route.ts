import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeRarity } from '@/lib/rarity'
import players from '@/data/nba-players.json'

export const maxDuration = 60

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = request.headers.get('authorization')
  const qp = new URL(request.url).searchParams.get('secret')
  return header === `Bearer ${secret}` || qp === secret
}

// Loads the curated NBA player -> franchise dataset into the players table.
// Idempotent: re-running just refreshes the rows. Uses the player name as the
// stable id (external_id) since this is a hand-curated source.
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const db = createAdminClient()

  const rows = (players as { name: string; teams: string[] }[]).map((p) => ({
    sport: 'nba',
    external_id: `curated:${p.name}`,
    name: p.name,
    teams: [...new Set(p.teams)].sort(),
    rarity: computeRarity(),
    updated_at: new Date().toISOString(),
  }))

  const { error } = await db
    .from('players')
    .upsert(rows, { onConflict: 'sport,external_id' })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, imported: rows.length })
}
