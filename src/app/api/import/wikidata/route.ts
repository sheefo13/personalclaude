import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeRarity } from '@/lib/rarity'
import { teamToAbbr } from '@/lib/nba-team-map'

export const maxDuration = 60

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = request.headers.get('authorization')
  const qp = new URL(request.url).searchParams.get('secret')
  return header === `Bearer ${secret}` || qp === secret
}

// All (player, team) pairs where the team's league is the NBA (Q155223).
// Covers current + historical NBA franchises that carry the NBA league tag.
const SPARQL = `
SELECT ?player ?playerLabel ?teamLabel WHERE {
  ?team wdt:P118 wd:Q155223 .
  ?player wdt:P54 ?team .
  ?player wdt:P106 wd:Q3665646 .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`

interface Binding {
  player: { value: string }
  playerLabel: { value: string }
  teamLabel: { value: string }
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url =
    'https://query.wikidata.org/sparql?format=json&query=' +
    encodeURIComponent(SPARQL)

  let bindings: Binding[]
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/sparql-results+json',
        'User-Agent': 'GridloreBot/1.0 (sports trivia game; contact via app)',
      },
      cache: 'no-store',
    })
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `Wikidata ${res.status}: ${(await res.text()).slice(0, 200)}` },
        { status: 502 }
      )
    }
    const json = await res.json()
    bindings = json.results.bindings
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: msg }, { status: 502 })
  }

  // player Q-id -> { name, teams set }
  const players = new Map<string, { name: string; teams: Set<string> }>()
  let unmappedTeams = 0

  for (const b of bindings) {
    const qid = b.player.value.split('/').pop() as string
    const name = b.playerLabel.value
    // Skip rows where the label is just the Q-id (no English label).
    if (/^Q\d+$/.test(name)) continue
    const abbr = teamToAbbr(b.teamLabel.value)
    if (!abbr) {
      unmappedTeams++
      continue
    }
    const entry = players.get(qid) ?? { name, teams: new Set<string>() }
    entry.teams.add(abbr)
    players.set(qid, entry)
  }

  const rows = [...players.entries()]
    .filter(([, p]) => p.teams.size > 0)
    .map(([qid, p]) => ({
      sport: 'nba',
      external_id: `wikidata:${qid}`,
      name: p.name,
      teams: [...p.teams].sort(),
      rarity: computeRarity(),
      updated_at: new Date().toISOString(),
    }))

  // Upsert in batches to stay within statement limits.
  const db = createAdminClient()
  const BATCH = 500
  let upserted = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH)
    const { error } = await db
      .from('players')
      .upsert(chunk, { onConflict: 'sport,external_id' })
    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message, upsertedBeforeError: upserted },
        { status: 500 }
      )
    }
    upserted += chunk.length
  }

  return NextResponse.json({
    ok: true,
    rowsFromWikidata: bindings.length,
    playersUpserted: upserted,
    unmappedTeamRows: unmappedTeams,
  })
}
