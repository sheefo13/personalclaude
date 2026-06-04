import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const maxDuration = 60

// Work budget per invocation; we self-trigger the next run before timing out.
const TIME_BUDGET_MS = 50_000
const BATCH = 50

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const qp = new URL(request.url).searchParams.get('secret')
  return request.headers.get('authorization') === `Bearer ${secret}` || qp === secret
}

// Last 12 months as Wikimedia's YYYYMMDD00 monthly range.
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
      headers: { 'User-Agent': 'GridloreBot/1.0 (sports trivia game)' },
      cache: 'no-store',
    })
    if (!res.ok) return 0 // 404 = no/obscure article -> treated as low fame
    const json = await res.json()
    return (json.items ?? []).reduce(
      (s: number, it: { views: number }) => s + (it.views ?? 0),
      0
    )
  } catch {
    return 0
  }
}

// Rank players by fame and map to rarity 1-100 (more famous = higher rarity).
async function normalize(db: ReturnType<typeof createAdminClient>): Promise<number> {
  const { data } = await db
    .from('players')
    .select('id, fame_raw')
    .eq('sport', 'nba')
  const players = (data ?? []).map((p) => ({
    id: p.id as string,
    fame: (p.fame_raw as number) ?? 0,
  }))
  players.sort((a, b) => a.fame - b.fame)

  const n = players.length
  for (let i = 0; i < n; i++) {
    const rarity = n <= 1 ? 50 : Math.min(100, Math.max(1, 1 + Math.round((99 * i) / (n - 1))))
    await db.from('players').update({ rarity }).eq('id', players[i].id)
  }
  return n
}

function selfTrigger(request: Request) {
  const url = new URL(request.url)
  url.searchParams.set('secret', process.env.CRON_SECRET ?? '')
  // Best-effort: keep the function alive just long enough to dispatch the
  // next invocation, then move on. The successor runs independently.
  return fetch(url.toString(), { signal: AbortSignal.timeout(1500) }).catch(() => {})
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const db = createAdminClient()

  const { data: state } = await db
    .from('sync_state')
    .select('cursor, season')
    .eq('id', 'rarity')
    .maybeSingle()

  // season: 0 = collecting pageviews, 1 = finished
  if (state?.season === 1) {
    return NextResponse.json({ ok: true, complete: true, note: 'already enriched' })
  }

  let offset = state?.cursor ?? 0
  const { count } = await db
    .from('players')
    .select('id', { count: 'exact', head: true })
    .eq('sport', 'nba')
  const total = count ?? 0

  const startedAt = Date.now()
  let processed = 0
  let collectingDone = false

  while (Date.now() - startedAt < TIME_BUDGET_MS) {
    const { data: batch } = await db
      .from('players')
      .select('id, name')
      .eq('sport', 'nba')
      .order('id', { ascending: true })
      .range(offset, offset + BATCH - 1)

    if (!batch || batch.length === 0) {
      collectingDone = true
      break
    }

    await Promise.all(
      batch.map(async (p) => {
        const fame = await pageviews(p.name as string)
        await db.from('players').update({ fame_raw: fame }).eq('id', p.id)
      })
    )

    offset += batch.length
    processed += batch.length
    await db
      .from('sync_state')
      .upsert(
        { id: 'rarity', season: 0, cursor: offset, updated_at: new Date().toISOString() },
        { onConflict: 'id' }
      )

    if (batch.length < BATCH) {
      collectingDone = true
      break
    }
  }

  if (collectingDone) {
    const ranked = await normalize(db)
    await db
      .from('sync_state')
      .upsert(
        { id: 'rarity', season: 1, cursor: offset, updated_at: new Date().toISOString() },
        { onConflict: 'id' }
      )
    return NextResponse.json({
      ok: true,
      complete: true,
      processedThisRun: processed,
      totalRanked: ranked,
    })
  }

  // More to do — launch the next link in the chain, then return.
  await selfTrigger(request)
  return NextResponse.json({
    ok: true,
    complete: false,
    processedThisRun: processed,
    progress: `${offset}/${total}`,
  })
}
