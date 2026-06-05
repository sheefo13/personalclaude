import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ChallengeGame from './challenge-game'

interface ChallengeData {
  code: string
  grid_date: string
  sport: string
  challenger_id: string
  challenger_score: number
  challengerUsername: string
  responses: Array<{ userId: string; score: number; completedAt: string; username: string }>
}

async function getChallengeData(code: string): Promise<ChallengeData | null> {
  const admin = createAdminClient()
  const { data: challenge, error } = await admin
    .from('challenges')
    .select('id, code, grid_date, sport, challenger_id, challenger_score, responses, created_at')
    .eq('code', code.toUpperCase())
    .single()

  if (error || !challenge) return null

  const { data: profile } = await admin
    .from('profiles')
    .select('username')
    .eq('id', challenge.challenger_id)
    .single()

  return {
    code: challenge.code,
    grid_date: challenge.grid_date,
    sport: challenge.sport,
    challenger_id: challenge.challenger_id,
    challenger_score: challenge.challenger_score,
    challengerUsername: profile?.username ?? 'Unknown',
    responses: challenge.responses ?? [],
  }
}

async function getGridForDate(date: string, sport: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('grid_schedules')
    .select('col_teams, row_teams')
    .eq('date', date)
    .eq('sport', sport)
    .maybeSingle()

  if (!data) return null
  return { colTeams: data.col_teams as string[], rowTeams: data.row_teams as string[] }
}

export default async function ChallengePage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params

  const challenge = await getChallengeData(code)
  if (!challenge) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center">
        <p className="text-2xl font-bold mb-4">Challenge not found</p>
        <Link href="/" className="text-indigo-400 hover:text-indigo-300">← Back home</Link>
      </main>
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const shareUrl = `https://gridlore.vercel.app/challenge/${challenge.code}`

  // Not logged in — show info and prompt to sign up
  if (!user) {
    return (
      <main className="min-h-screen bg-gray-950 text-white p-4 flex flex-col items-center justify-center">
        <div className="w-full max-w-lg text-center">
          <p className="text-gray-400 text-sm mb-2 uppercase tracking-wider">Challenge from</p>
          <h1 className="text-3xl font-bold mb-1">{challenge.challengerUsername}</h1>
          <p className="text-gray-400 mb-6">They scored <span className="text-indigo-400 font-bold">{challenge.challenger_score}</span> · can you beat them?</p>
          <div className="bg-gray-900 rounded-2xl p-6 mb-6">
            <p className="text-gray-400 text-sm mb-4">Sign up to accept this challenge and track your head-to-head record.</p>
            <Link
              href="/auth"
              className="block w-full py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-semibold transition-colors"
            >
              Sign up to play
            </Link>
          </div>
          <Link href="/" className="text-gray-400 hover:text-white text-sm">← Back home</Link>
        </div>
      </main>
    )
  }

  // User is the challenger
  if (user.id === challenge.challenger_id) {
    return (
      <main className="min-h-screen bg-gray-950 text-white p-4 flex flex-col items-center">
        <div className="w-full max-w-lg">
          <div className="flex items-center justify-between mb-6">
            <Link href="/" className="text-gray-400 hover:text-white text-sm">← Home</Link>
            <h1 className="text-xl font-bold">Your Challenge</h1>
            <div />
          </div>

          <div className="bg-gray-900 rounded-2xl p-6 mb-4">
            <p className="text-center text-gray-400 text-sm mb-1 uppercase tracking-wider">Your score</p>
            <p className="text-center text-4xl font-bold text-indigo-400 mb-4">{challenge.challenger_score}</p>

            <p className="text-sm font-semibold text-gray-300 mb-2">Share link</p>
            <div className="flex gap-2 items-center bg-gray-800 rounded-xl px-4 py-3 mb-4">
              <span className="text-sm text-gray-300 truncate flex-1">{shareUrl}</span>
            </div>
            <CopyButton url={shareUrl} />
          </div>

          {challenge.responses.length === 0 ? (
            <div className="bg-gray-900 rounded-2xl p-6 text-center">
              <p className="text-gray-400">Waiting for responses…</p>
              <p className="text-gray-500 text-sm mt-1">Share the link above to challenge friends!</p>
            </div>
          ) : (
            <div className="bg-gray-900 rounded-2xl p-5">
              <h2 className="font-bold text-lg mb-4">Responses ({challenge.responses.length})</h2>
              <div className="space-y-3">
                {challenge.responses.map((r) => {
                  const result = r.score > challenge.challenger_score ? 'loss' : r.score < challenge.challenger_score ? 'win' : 'tie'
                  return (
                    <div key={r.userId} className={`flex items-center justify-between rounded-xl px-4 py-3 ${
                      result === 'win' ? 'bg-green-900/30 border border-green-700' :
                      result === 'loss' ? 'bg-red-900/30 border border-red-700' :
                      'bg-gray-800 border border-gray-700'
                    }`}>
                      <span className="font-semibold">{r.username}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-indigo-400 font-bold">{r.score}</span>
                        <span className="text-xs font-bold uppercase">
                          {result === 'win' ? '✓ You win' : result === 'loss' ? '✗ You lose' : '= Tie'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    )
  }

  // Check if user has already responded
  const existingResponse = challenge.responses.find((r) => r.userId === user.id)
  if (existingResponse) {
    const result = existingResponse.score > challenge.challenger_score ? 'win'
      : existingResponse.score < challenge.challenger_score ? 'loss' : 'tie'
    const resultLabel = result === 'win' ? '🏆 You WIN!' : result === 'loss' ? '😅 You lose' : '🤝 Tie!'

    return (
      <main className="min-h-screen bg-gray-950 text-white p-4 flex flex-col items-center justify-center">
        <div className="w-full max-w-lg">
          <div className={`bg-gray-900 rounded-2xl p-8 text-center ${
            result === 'win' ? 'border border-green-700' :
            result === 'loss' ? 'border border-red-700' :
            'border border-gray-700'
          }`}>
            <p className="text-3xl font-bold mb-4">{resultLabel}</p>
            <p className="text-gray-300 mb-6">
              You scored <span className="text-indigo-400 font-bold">{existingResponse.score}</span> vs{' '}
              <span className="font-bold text-white">{challenge.challengerUsername}</span>&apos;s{' '}
              <span className="text-indigo-400 font-bold">{challenge.challenger_score}</span>
            </p>
            <Link href="/" className="text-gray-400 hover:text-white text-sm">← Back home</Link>
          </div>
        </div>
      </main>
    )
  }

  // User hasn't responded yet — show the playable grid
  const grid = await getGridForDate(challenge.grid_date, challenge.sport)
  if (!grid) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center">
        <p className="text-xl font-bold mb-2">Grid not available</p>
        <p className="text-gray-400 text-sm mb-4">The grid for this challenge date couldn&apos;t be loaded.</p>
        <Link href="/" className="text-indigo-400 hover:text-indigo-300">← Back home</Link>
      </main>
    )
  }

  return (
    <ChallengeGame
      rowTeams={grid.rowTeams}
      colTeams={grid.colTeams}
      code={challenge.code}
      challengerScore={challenge.challenger_score}
      challengerUsername={challenge.challengerUsername}
    />
  )
}

// Small inline copy button (server component can't hold state, so this is a client island)
function CopyButton({ url }: { url: string }) {
  // We render a simple script-free fallback; the actual copy logic is in CopyButtonClient
  return <CopyButtonClient url={url} />
}

// This needs to be a client component but we can inline it since it's tiny
import CopyButtonClient from './copy-button-client'
