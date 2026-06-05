import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
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
