// Minimal BallDontLie API v1 client.
// Free tier requires an API key, passed in the Authorization header.
// Docs: https://docs.balldontlie.io

const BASE = 'https://api.balldontlie.io/v1'

function authHeaders() {
  const key = process.env.BALLDONTLIE_API_KEY
  if (!key) throw new Error('BALLDONTLIE_API_KEY is not set')
  return { Authorization: key }
}

export interface BdlTeam {
  id: number
  abbreviation: string
  full_name: string
}

export interface BdlStat {
  player: { id: number; first_name: string; last_name: string }
  team: BdlTeam
}

export interface StatsPage {
  data: BdlStat[]
  meta: { next_cursor: number | null }
}

// Fetch one page of per-game stats for a given season. We only use the
// (player, team) pairing to build each player's career team set.
export async function fetchStatsPage(
  season: number,
  cursor: number | null,
  perPage = 100
): Promise<StatsPage> {
  const params = new URLSearchParams()
  params.set('seasons[]', String(season))
  params.set('per_page', String(perPage))
  if (cursor != null) params.set('cursor', String(cursor))

  const res = await fetch(`${BASE}/stats?${params.toString()}`, {
    headers: authHeaders(),
    cache: 'no-store',
  })

  if (res.status === 429) throw new Error('RATE_LIMITED')
  if (!res.ok) throw new Error(`BallDontLie error ${res.status}: ${await res.text()}`)

  return res.json()
}
