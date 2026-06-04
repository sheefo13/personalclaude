import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeRarity } from '@/lib/rarity'
import { teamToAbbr } from '@/lib/nba-team-map'

export const maxDuration = 60

// Paginate Wikidata so each page completes within its query time limit.
const PAGE_SIZE = 4000
const PAGES_PER_RUN = 3

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = request.headers.get('authorization')
  const qp = new URL(request.url).searchParams.get('secret')
  return header === `Bearer ${secret}` || qp === secret
}

// One page of (player, team) pairs where the team's league is the NBA.
// ORDER BY gives a stable order so OFFSET paging doesn't skip/repeat rows.
function sparql(offset: number): string {
  return `
SELECT ?player ?playerLabel ?teamLabel WHERE {
  ?team wdt:P118 wd:Q155223 .
  ?player wdt:P54 ?team .
  ?player wdt:P106 wd:Q3665646 .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY ?player ?teamLabel
LIMIT ${PAGE_SIZE} OFFSET ${offset}`
}

interface Binding {
  player: { value: string }
  playerLabel: { value: string }
  teamLabel: { value: string }
}

async function fetchPage(offset: number): Promise<Binding[]> {
  const url =
    'https://query.wikidata.org/sparql?format=json&query=' +
    encodeURIComponent(sparql(offset))
  const res = await fetch(url, {
    headers: {
      Accept: 'application/sparql-results+json',
      'User-Agent': 'GridloreBot/1.0 (sports trivia game; contact via app)',
    },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Wikidata ${res.status}: ${(await res.text()).slice(0, 150)}`)
  const json = await res.json()
  return json.results.bindings
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const db = createAdminClient()

  // Resume from the saved offset (reuse sync_state; 'season' unused here).
  const { data: state } = await db
    .from('sync_state')
    .select('cursor')
    .eq('id', 'wikidata')
    .maybeSingle()
  let offset = state?.cursor ?? 0

  const players = new Map<string, { name: string; teams: Set<string> }>()
  let rowsSeen = 0
  let unmapped = 0
  let done = false

  try {
    for (let page = 0; page < PAGES_PER_RUN; page++) {
      const bindings = await fetchPage(offset)
      rowsSeen += bindings.length

      for (const b of bindings) {
        const qid = b.player.value.split('/').pop() as string
        const name = b.playerLabel.value
        if (/^Q\d+$/.test(name)) continue
        const abbr = teamToAbbr(b.teamLabel.value)
        if (!abbr) {
          unmapped++
          continue
        }
        const entry = players.get(qid) ?? { name, teams: new Set<string>() }
        entry.teams.add(abbr)
        players.set(qid, entry)
      }

      offset += bindings.length
      if (bindings.length < PAGE_SIZE) {
        done = true
        break
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await persist(db, players)
    await saveOffset(db, done ? 0 : offset)
    return NextResponse.json({ ok: false, error: msg, playersTouched: players.size }, { status: 502 })
  }

  const upserted = await persist(db, players)
  await saveOffset(db, done ? 0 : offset)

  return NextResponse.json({
    ok: true,
    rowsThisRun: rowsSeen,
    playersUpserted: upserted,
    unmappedTeamRows: unmapped,
    nextOffset: done ? 0 : offset,
    complete: done,
  })
}

// Merge freshly-seen teams into each player's existing teams array.
async function persist(
  db: ReturnType<typeof createAdminClient>,
  players: Map<string, { name: string; teams: Set<string> }>
): Promise<number> {
  if (players.size === 0) return 0
  const rows = [...players.entries()].map(([qid, p]) => ({
    sport: 'nba',
    external_id: `wikidata:${qid}`,
    name: p.name,
    teams: [...p.teams].sort(),
    rarity: computeRarity(),
    updated_at: new Date().toISOString(),
  }))

  const ids = rows.map((r) => r.external_id)
  const { data: existing } = await db
    .from('players')
    .select('external_id, teams')
    .in('external_id', ids)
  const prev = new Map<string, string[]>()
  for (const row of existing ?? []) prev.set(row.external_id as string, (row.teams as string[]) ?? [])

  for (const r of rows) {
    r.teams = [...new Set([...(prev.get(r.external_id) ?? []), ...r.teams])].sort()
  }

  const BATCH = 500
  let n = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await db
      .from('players')
      .upsert(rows.slice(i, i + BATCH), { onConflict: 'sport,external_id' })
    if (error) throw new Error(error.message)
    n += Math.min(BATCH, rows.length - i)
  }
  return n
}

async function saveOffset(db: ReturnType<typeof createAdminClient>, offset: number) {
  await db
    .from('sync_state')
    .upsert(
      { id: 'wikidata', season: 0, cursor: offset, updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    )
}
