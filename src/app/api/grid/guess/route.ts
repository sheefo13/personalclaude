import { NextResponse } from 'next/server'
import { getNbaPlayers } from '@/lib/game-server'
import { findAnswer, scoreCell } from '@/lib/grid'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  // Must be logged in to play.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { rowTeam, colTeam, name, elapsedSec } = body as {
    rowTeam: string
    colTeam: string
    name: string
    elapsedSec: number
  }

  if (!rowTeam || !colTeam || !name) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }

  const players = await getNbaPlayers()
  const match = findAnswer(players, name, rowTeam, colTeam)

  if (!match) {
    return NextResponse.json({ correct: false })
  }

  const points = scoreCell(match.rarity, Math.max(0, Math.floor(elapsedSec ?? 999)))
  return NextResponse.json({
    correct: true,
    playerName: match.name,
    rarity: match.rarity,
    points,
  })
}
