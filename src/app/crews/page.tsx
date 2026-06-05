import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CreateCrewForm, JoinCrewForm, CopyCode } from './crews-ui'

interface LeaderboardEntry {
  username: string
  weekly_score: number
  season_score: number
}

interface Crew {
  id: string
  name: string
  invite_code: string
  owner_id: string
  leaderboard: LeaderboardEntry[]
}

export default async function CrewsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/api/crews/mine`, {
    headers: { Cookie: '' }, // will be handled server-side via supabase session
    cache: 'no-store',
  })

  // Fetch crews directly via supabase instead of internal fetch (avoids cookie issues)
  const { data: memberships } = await supabase
    .from('crew_members')
    .select('crew_id')
    .eq('user_id', user.id)

  const crewIds = (memberships ?? []).map((m: { crew_id: string }) => m.crew_id)

  let crews: Crew[] = []

  if (crewIds.length) {
    const { data: crewData } = await supabase
      .from('crews')
      .select('id, name, invite_code, owner_id')
      .in('id', crewIds)

    const today = new Date()
    const day = today.getUTCDay()
    const diff = day === 0 ? -6 : 1 - day
    today.setUTCDate(today.getUTCDate() + diff)
    const currentWeekStart = today.toISOString().slice(0, 10)

    crews = await Promise.all(
      (crewData ?? []).map(async (crew: { id: string; name: string; invite_code: string; owner_id: string }) => {
        const { data: scores } = await supabase
          .from('crew_scores')
          .select('user_id, weekly_score, season_score')
          .eq('crew_id', crew.id)
          .eq('week_start', currentWeekStart)
          .order('weekly_score', { ascending: false })

        const userIds = (scores ?? []).map((s: { user_id: string }) => s.user_id)
        let usernameMap: Record<string, string> = {}
        if (userIds.length) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, username')
            .in('id', userIds)
          usernameMap = Object.fromEntries(
            (profiles ?? []).map((p: { id: string; username: string }) => [p.id, p.username])
          )
        }

        const leaderboard: LeaderboardEntry[] = (scores ?? []).map((s: { user_id: string; weekly_score: number; season_score: number }) => ({
          username: usernameMap[s.user_id] ?? 'Unknown',
          weekly_score: s.weekly_score,
          season_score: s.season_score,
        }))

        return { ...crew, leaderboard }
      })
    )
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-4 flex flex-col items-center">
      <div className="w-full max-w-2xl">
        <div className="flex items-center mb-8">
          <Link href="/" className="text-gray-400 hover:text-white text-sm mr-4">← Home</Link>
          <h1 className="text-2xl font-bold">My Crews</h1>
        </div>

        {/* Create / Join */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
          <div className="bg-gray-900 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Create a crew</h2>
            <CreateCrewForm />
          </div>
          <div className="bg-gray-900 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Join a crew</h2>
            <JoinCrewForm />
          </div>
        </div>

        {/* Crew cards */}
        {crews.length === 0 ? (
          <p className="text-gray-500 text-center">You&apos;re not in any crews yet. Create one or join with an invite code.</p>
        ) : (
          <div className="space-y-6">
            {crews.map((crew) => (
              <div key={crew.id} className="bg-gray-900 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold">{crew.name}</h2>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 mb-0.5">Invite code</p>
                    <CopyCode code={crew.invite_code} />
                  </div>
                </div>

                {crew.leaderboard.length === 0 ? (
                  <p className="text-gray-600 text-sm">No scores yet this week. Play a game to get on the board!</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 text-xs uppercase">
                        <th className="text-left pb-2 w-8">#</th>
                        <th className="text-left pb-2">Player</th>
                        <th className="text-right pb-2">This Week</th>
                        <th className="text-right pb-2">Season</th>
                      </tr>
                    </thead>
                    <tbody>
                      {crew.leaderboard.map((entry, i) => (
                        <tr key={entry.username} className="border-t border-gray-800">
                          <td className="py-2 text-gray-500">{i + 1}</td>
                          <td className="py-2 font-medium">{entry.username}</td>
                          <td className="py-2 text-right text-indigo-400 font-bold">{entry.weekly_score}</td>
                          <td className="py-2 text-right text-gray-400">{entry.season_score}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
