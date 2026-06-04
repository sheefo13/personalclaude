import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Tiny batch so this finishes well within Vercel's 10s free-tier limit.
const BATCH = 5
const WIKIMEDIA_TIMEOUT_MS = 3000

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const qp = new URL(request.url).searchParams.get('secret')
  return request.headers.get('authorization') === `Bearer ${secret}` || qp === secret
}

function monthlyRange(): { start: string; end: string } {
  const now = new Date()
  const end = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}0100`
  const past = new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), 1))
  const start = `${past.getUTCFullYear()}${String(past.getUTCMonth() + 1).padStart(2, '0')}0100`
  return { start, end }
}

async function pageviews(name: string): Promise<number> {
  const { start, end } = monthlyRange()
  const title = encodeURIComponent(name.replace(/ /g, '_'))
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/all-agents/${title}/monthly/${start}/${end}`
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'GridloreBot/1.0' },
      signal: AbortSignal.timeout(WIKIMEDIA_TIMEOUT_MS),
      cache: 'no-store',
    })
    if (!res.ok) return 0
    const json = await res.json()
    return (json.items ?? []).reduce((s: number, it: { views: number }) => s + it.views, 0)
  } catch {
    return 0
  }
}

async function normalize(db: ReturnType<typeof createAdminClient>): Promise<number> {
  const { data } = await db.from('players').select('id, fame_raw').eq('sport', 'nba')
  const players = (data ?? []).map((p) => ({ id: p.id as string, fame: (p.fame_raw as number) ?? 0 }))
  players.sort((a, b) => a.fame - b.fame)
  const n = players.length
  const CHUNK = 200
  for (let i = 0; i < n; i += CHUNK) {
    const updates = players.slice(i, i + CHUNK).map((p, j) => {
      const idx = i + j
      const rarity = n <= 1 ? 50 : Math.min(100, Math.max(1, 1 + Math.round((99 * idx) / (n - 1))))
      return db.from('players').update({ rarity }).eq('id', p.id)
    })
    await Promise.all(updates)
  }
  return n
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const db = createAdminClient()

  const { data: state } = await db
    .from('sync_state').select('cursor, season').eq('id', 'rarity').maybeSingle()

  if (state?.season === 1) {
    return NextResponse.json({ ok: true, complete: true, note: 'already enriched' })
  }

  let offset = state?.cursor ?? 0

  const { count } = await db
    .from('players').select('id', { count: 'exact', head: true }).eq('sport', 'nba')
  const total = count ?? 0

  const { data: batch } = await db
    .from('players').select('id, name').eq('sport', 'nba')
    .order('id', { ascending: true })
    .range(offset, offset + BATCH - 1)

  if (!batch || batch.length === 0) {
    const ranked = await normalize(db)
    await db.from('sync_state').upsert(
      { id: 'rarity', season: 1, cursor: offset, updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    )
    return NextResponse.json({ ok: true, complete: true, totalRanked: ranked })
  }

  await Promise.all(
    batch.map(async (p) => {
      const fame = await pageviews(p.name as string)
      await db.from('players').update({ fame_raw: fame }).eq('id', p.id)
    })
  )

  offset += batch.length
  const complete = offset >= total

  await db.from('sync_state').upsert(
    { id: 'rarity', season: complete ? 1 : 0, cursor: offset, updated_at: new Date().toISOString() },
    { onConflict: 'id' }
  )

  if (complete) {
    const ranked = await normalize(db)
    return NextResponse.json({ ok: true, complete: true, totalRanked: ranked })
  }

  return NextResponse.json({ ok: true, complete: false, processed: offset, total })
}
