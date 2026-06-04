import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateTodayGrid } from '@/lib/game-server'
import Game from './game'

export default async function PlayPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const grid = await getOrCreateTodayGrid()

  if (!grid) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-gray-950 text-white p-6 text-center">
        <h1 className="text-2xl font-bold mb-2">No grid available yet</h1>
        <p className="text-gray-400 mb-6">
          We couldn&apos;t build a valid grid from the current player data.
        </p>
        <Link href="/" className="text-indigo-400 hover:underline">
          Back home
        </Link>
      </main>
    )
  }

  return <Game rowTeams={grid.rowTeams} colTeams={grid.colTeams} />
}
