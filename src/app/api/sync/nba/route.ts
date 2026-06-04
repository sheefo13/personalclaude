import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchStatsPage } from '@/lib/balldontlie'
import { computeRarity } from '@/lib/rarity'

// Give the function as much time as the plan allows; the sync is bounded by
// REQUEST_BUDGET below so it finishes well within this.
export const maxDuration = 60

// Sweep these seasons (newest first). Each run advances through them.
const NEWEST_SEASON = 2024
const OLDEST_SEASON = 2020
// Max API requests per invocation — keeps us inside the timeout + rate limits.
const REQUEST_BUDGET = 25

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = request.headers.get('authorization')
  const url = new URL(request.url)
  const qp = url.searchParams.get('secret')
  return header === `Bearer ${secret}` || qp === secret
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // Safe diagnostic: confirms whether env vars are reaching the function
  // without ever revealing their values.
  if (new URL(request.url).searchParams.get('debug') === '1') {
    const key = process.env.BALLDONTLIE_API_KEY ?? ''
    return NextResponse.json({
      balldontlieKeyPresent: key.length > 0,
      balldontlieKeyLength: key.length,
      isPlaceholder: key === 'your-balldontlie-api-key',
      serviceRoleKeyPresent: (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').length > 0,
    })
  }

  const db = createAdminClient()

  // Load (or initialise) where we left off.
  const { data: state } = await db
    .from('sync_state')
    .select('*')
    .eq('id', 'nba')
    .maybeSingle()

  let season = state?.season ?? NEWEST_SEASON
  let cursor: number | null = state?.cursor ?? null

  // player external_id -> { name, teams set }
  const collected = new Map<string, { name: string; teams: Set<string> }>()
  let requests = 0
  let done = false

  try {
    while (requests < REQUEST_BUDGET) {
      const page = await fetchStatsPage(season, cursor)
      requests++

      for (const stat of page.data) {
        const id = String(stat.player.id)
        const name = `${stat.player.first_name} ${stat.player.last_name}`.trim()
        const abbr = stat.team?.abbreviation
        if (!abbr) continue
        const entry = collected.get(id) ?? { name, teams: new Set<string>() }
        entry.teams.add(abbr)
        collected.set(id, entry)
      }

      cursor = page.meta.next_cursor
      if (cursor == null) {
        // Season finished — move to the previous one.
        if (season <= OLDEST_SEASON) {
          done = true
          break
        }
        season -= 1
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // Persist what we gathered before bailing on a rate-limit/error.
    await persist(db, collected)
    await saveState(db, season, cursor)
    return NextResponse.json(
      { ok: false, error: msg, playersTouched: collected.size, requests },
      { status: msg === 'RATE_LIMITED' ? 429 : 500 }
    )
  }

  const upserted = await persist(db, collected)
  await saveState(db, done ? NEWEST_SEASON : season, done ? null : cursor)

  return NextResponse.json({
    ok: true,
    requests,
    playersTouched: collected.size,
    upserted,
    season,
    sweepComplete: done,
  })
}

// Merge each player's freshly-seen teams into the existing teams array.
async function persist(
  db: ReturnType<typeof createAdminClient>,
  collected: Map<string, { name: string; teams: Set<string> }>
): Promise<number> {
  if (collected.size === 0) return 0
  const ids = [...collected.keys()]

  const { data: existing } = await db
    .from('players')
    .select('external_id, teams')
    .eq('sport', 'nba')
    .in('external_id', ids)

  const existingTeams = new Map<string, string[]>()
  for (const row of existing ?? []) {
    existingTeams.set(row.external_id as string, (row.teams as string[]) ?? [])
  }

  const rows = [...collected.entries()].map(([id, { name, teams }]) => {
    const merged = new Set<string>([...(existingTeams.get(id) ?? []), ...teams])
    return {
      sport: 'nba',
      external_id: id,
      name,
      teams: [...merged].sort(),
      rarity: computeRarity(),
      updated_at: new Date().toISOString(),
    }
  })

  const { error } = await db
    .from('players')
    .upsert(rows, { onConflict: 'sport,external_id' })
  if (error) throw new Error(`upsert failed: ${error.message}`)
  return rows.length
}

async function saveState(
  db: ReturnType<typeof createAdminClient>,
  season: number,
  cursor: number | null
) {
  await db.from('sync_state').upsert(
    { id: 'nba', season, cursor, updated_at: new Date().toISOString() },
    { onConflict: 'id' }
  )
}
