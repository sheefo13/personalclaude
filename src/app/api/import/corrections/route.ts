import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import corrections from '@/data/nba-corrections.json'

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const qp = new URL(request.url).searchParams.get('secret')
  return request.headers.get('authorization') === `Bearer ${secret}` || qp === secret
}

// Merges the corrections file into existing player rows by name match.
// If a player doesn't exist yet, inserts them. Idempotent.
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const db = createAdminClient()
  const names = corrections.map((c) => c.name)

  // Load any existing rows so we can merge teams rather than overwrite.
  const { data: existing } = await db
    .from('players')
    .select('id, name, teams, external_id')
    .eq('sport', 'nba')
    .in('name', names)

  const byName = new Map(
    (existing ?? []).map((p) => [p.name as string, p])
  )

  let updated = 0
  let inserted = 0

  for (const correction of corrections as { name: string; teams: string[] }[]) {
    const existing = byName.get(correction.name)
    const merged = [...new Set([...(existing?.teams ?? []), ...correction.teams])].sort()

    if (existing) {
      await db.from('players').update({ teams: merged, updated_at: new Date().toISOString() }).eq('id', existing.id)
      updated++
    } else {
      await db.from('players').insert({
        sport: 'nba',
        external_id: `correction:${correction.name}`,
        name: correction.name,
        teams: merged,
        rarity: 50,
        updated_at: new Date().toISOString(),
      })
      inserted++
    }
  }

  return NextResponse.json({ ok: true, updated, inserted, total: corrections.length })
}
