import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Autocomplete by name. Deliberately returns ONLY names (no teams), so it
// helps the player type without revealing whether a name fits the cell.
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json({ players: [] })

  const db = createAdminClient()
  const { data } = await db
    .from('players')
    .select('name')
    .eq('sport', 'nba')
    .ilike('name', `%${q}%`)
    .limit(8)

  const names = [...new Set((data ?? []).map((p) => p.name as string))]
  return NextResponse.json({ players: names })
}
