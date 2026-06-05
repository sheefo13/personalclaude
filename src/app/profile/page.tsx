import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { BADGES } from '@/lib/badges'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, stats, badges, streak_freezes')
    .eq('id', user.id)
    .single()

  // H2H record
  const admin = createAdminClient()
  const threeDaysAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString() // all time for history

  // Challenges where user is challenger
  const { data: createdChallenges } = await admin
    .from('challenges')
    .select('challenger_score, responses, code, created_at')
    .eq('challenger_id', user.id)
    .order('created_at', { ascending: false })

  // Compute H2H record
  type H2HEntry = { code: string; opponent: string; myScore: number; theirScore: number; result: 'win' | 'loss' | 'tie'; date: string }
  const h2hHistory: H2HEntry[] = []
  let wins = 0, losses = 0, ties = 0

  for (const ch of createdChallenges ?? []) {
    const responses: Array<{ userId: string; score: number; completedAt: string; username: string }> = ch.responses ?? []
    for (const r of responses) {
      let result: 'win' | 'loss' | 'tie'
      if (ch.challenger_score > r.score) result = 'win'
      else if (ch.challenger_score < r.score) result = 'loss'
      else result = 'tie'

      if (result === 'win') wins++
      else if (result === 'loss') losses++
      else ties++

      h2hHistory.push({ code: ch.code, opponent: r.username, myScore: ch.challenger_score, theirScore: r.score, result, date: r.completedAt })
    }
  }

  // Challenges where user responded
  // We need to find challenges where responses contains userId = user.id
  // Using admin client with a raw filter on jsonb
  const { data: allChallengesWithResponse } = await admin
    .from('challenges')
    .select('code, challenger_score, responses, created_at')
    .neq('challenger_id', user.id)
    .order('created_at', { ascending: false })

  for (const ch of allChallengesWithResponse ?? []) {
    const responses: Array<{ userId: string; score: number; completedAt: string; username: string }> = ch.responses ?? []
    const myResponse = responses.find((r) => r.userId === user.id)
    if (!myResponse) continue

    let result: 'win' | 'loss' | 'tie'
    if (myResponse.score > ch.challenger_score) result = 'win'
    else if (myResponse.score < ch.challenger_score) result = 'loss'
    else result = 'tie'

    if (result === 'win') wins++
    else if (result === 'loss') losses++
    else ties++

    // Get challenger username from existing responses or we skip
    h2hHistory.push({ code: ch.code, opponent: 'Challenger', myScore: myResponse.score, theirScore: ch.challenger_score, result, date: myResponse.completedAt })
  }

  // Sort by date desc, take last 5
  h2hHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  const recentH2H = h2hHistory.slice(0, 5)

  const stats = (profile?.stats ?? {}) as Record<string, unknown>
  const earnedBadges = new Set((profile?.badges ?? []) as string[])

  const streak = (stats.streak as number) ?? 0
  const longestStreak = (stats.longestStreak as number) ?? 0
  const gridsCompleted = (stats.gridsCompleted as number) ?? 0
  const bestScore = (stats.bestScore as number) ?? 0
  const streakFreezes = (profile?.streak_freezes as number) ?? 0
  const sportBreakdown = (stats.sportBreakdown as Record<string, number>) ?? { nba: 0, soccer: 0 }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-4 flex flex-col items-center">
      <div className="w-full max-w-lg">

        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="text-gray-400 hover:text-white text-sm">← Home</Link>
          <h1 className="text-xl font-bold">Profile</h1>
          <div />
        </div>

        {/* Header */}
        <div className="bg-gray-900 rounded-2xl p-6 mb-4 text-center">
          <div className="w-16 h-16 rounded-full bg-indigo-700 flex items-center justify-center text-2xl font-bold mx-auto mb-3">
            {(profile?.username as string)?.[0]?.toUpperCase() ?? '?'}
          </div>
          <h2 className="text-2xl font-bold">{profile?.username}</h2>
          <p className="text-gray-400 text-sm">{user.email}</p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <StatCard emoji="🔥" label="Current streak" value={`${streak} days`} highlight={streak >= 7} />
          <StatCard emoji="🏆" label="Longest streak" value={`${longestStreak} days`} />
          <StatCard emoji="🏀" label="Grids played" value={String(gridsCompleted)} />
          <StatCard emoji="⭐" label="Best score" value={String(bestScore)} />
          <StatCard emoji="🧊" label="Streak freezes" value={String(streakFreezes)} />
          <StatCard emoji="📊" label="NBA grids" value={String(sportBreakdown.nba ?? 0)} />
        </div>

        {/* H2H Record */}
        <div className="bg-gray-900 rounded-2xl p-5 mb-4">
          <h2 className="font-bold text-lg mb-4">Head-to-Head Record</h2>
          <div className="flex justify-center gap-8 mb-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-green-400">{wins}</p>
              <p className="text-xs text-gray-400">Wins</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-red-400">{losses}</p>
              <p className="text-xs text-gray-400">Losses</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-400">{ties}</p>
              <p className="text-xs text-gray-400">Ties</p>
            </div>
          </div>
          <p className="text-center text-sm text-gray-500 mb-4">{wins}W · {losses}L · {ties}T</p>

          {recentH2H.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Recent results</p>
              {recentH2H.map((entry, i) => (
                <div key={i} className={`flex items-center justify-between rounded-xl px-4 py-2.5 text-sm ${
                  entry.result === 'win' ? 'bg-green-900/30 border border-green-800' :
                  entry.result === 'loss' ? 'bg-red-900/30 border border-red-800' :
                  'bg-gray-800 border border-gray-700'
                }`}>
                  <span className="text-gray-300">vs {entry.opponent}</span>
                  <span className="font-semibold">
                    {entry.myScore} – {entry.theirScore}{' '}
                    <span className={entry.result === 'win' ? 'text-green-400' : entry.result === 'loss' ? 'text-red-400' : 'text-gray-400'}>
                      {entry.result === 'win' ? 'W' : entry.result === 'loss' ? 'L' : 'T'}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-gray-500">No H2H games yet — challenge a friend!</p>
          )}
        </div>

        {/* Badges */}
        <div className="bg-gray-900 rounded-2xl p-5">
          <h3 className="font-bold text-lg mb-4">Badges</h3>
          <div className="grid grid-cols-1 gap-2">
            {BADGES.map((badge) => {
              const earned = earnedBadges.has(badge.id)
              return (
                <div
                  key={badge.id}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-colors ${
                    earned
                      ? 'bg-yellow-900/30 border border-yellow-700'
                      : 'bg-gray-800 border border-gray-700 opacity-40'
                  }`}
                >
                  <span className="text-2xl">{badge.emoji}</span>
                  <div>
                    <p className={`font-semibold text-sm ${earned ? 'text-yellow-300' : 'text-gray-400'}`}>
                      {badge.name}
                    </p>
                    <p className="text-xs text-gray-500">{badge.description}</p>
                  </div>
                  {earned && <span className="ml-auto text-yellow-500 text-xs font-bold">EARNED</span>}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </main>
  )
}

function StatCard({
  emoji, label, value, highlight,
}: {
  emoji: string; label: string; value: string; highlight?: boolean
}) {
  return (
    <div className={`rounded-xl p-4 ${highlight ? 'bg-orange-900/30 border border-orange-700' : 'bg-gray-900'}`}>
      <p className="text-2xl mb-1">{emoji}</p>
      <p className={`text-xl font-bold ${highlight ? 'text-orange-400' : ''}`}>{value}</p>
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  )
}
