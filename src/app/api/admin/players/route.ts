import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_EMAIL = 'sherief.elabbady@gmail.com'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return null
  return user
}

// GET /api/admin/players?q=rozier&sport=nba
export async function GET(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() ?? ''
  const sport = searchParams.get('sport') ?? 'nba'

  const db = createAdminClient()
  let query = db
    .from('players')
    .select('id, name, sport, teams, rarity, external_id')
    .eq('sport', sport)
    .order('name')
    .limit(50)

  if (q.length >= 2) {
    query = query.ilike('name', `%${q}%`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ players: data })
}

// POST /api/admin/players — create or update a player
export async function POST(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json() as { name: string; sport: string; teams: string[] }
  const { name, sport, teams } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })
  if (!Array.isArray(teams) || teams.length === 0) return NextResponse.json({ error: 'At least one team required' }, { status: 400 })

  const db = createAdminClient()

  // Upsert by name + sport (manual entries don't have external_id)
  const { data: existing } = await db
    .from('players')
    .select('id, teams')
    .eq('name', name.trim())
    .eq('sport', sport)
    .maybeSingle()

  if (existing) {
    const merged = [...new Set([...(existing.teams as string[]), ...teams])]
    const { error } = await db
      .from('players')
      .update({ teams: merged })
      .eq('id', existing.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, action: 'updated', teams: merged })
  }

  const { error } = await db
    .from('players')
    .insert({ name: name.trim(), sport, teams, rarity: 50 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, action: 'created' })
}
