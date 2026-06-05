import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import SignOutButton from './sign-out-button'

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let username: string | null = null
  let pendingChallenge: { code: string; challengerUsername: string } | null = null

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single()
    username = profile?.username ?? user.email ?? null

    // Check for pending challenges (created in last 3 days, user hasn't responded, user isn't challenger)
    const admin = createAdminClient()
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
    const { data: challenges } = await admin
      .from('challenges')
      .select('code, challenger_id, responses, created_at')
      .neq('challenger_id', user.id)
      .gte('created_at', threeDaysAgo)
      .order('created_at', { ascending: false })

    if (challenges) {
      for (const ch of challenges) {
        const responses: Array<{ userId: string }> = ch.responses ?? []
        if (!responses.some((r) => r.userId === user.id)) {
          // Get challenger username
          const { data: challengerProfile } = await admin
            .from('profiles')
            .select('username')
            .eq('id', ch.challenger_id)
            .single()
          pendingChallenge = { code: ch.code, challengerUsername: challengerProfile?.username ?? 'Someone' }
          break
        }
      }
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-950 text-white">
      <h1 className="text-5xl font-bold mb-4">Gridlore</h1>

      {user ? (
        <>
          <p className="text-gray-300 text-lg mb-2">
            Welcome back, <span className="font-semibold">{username}</span> 👋
          </p>
          <p className="text-gray-500 text-sm mb-4">
            Ready to play today&apos;s grid?
          </p>

          {pendingChallenge && (
            <Link
              href={`/challenge/${pendingChallenge.code}`}
              className="block mb-6 px-5 py-3 bg-indigo-900/50 border border-indigo-600 rounded-xl text-sm font-medium text-indigo-300 hover:bg-indigo-900/70 transition-colors"
            >
              🆚 You have a pending challenge from <span className="font-bold text-white">{pendingChallenge.challengerUsername}</span>! →
            </Link>
          )}

          <div className="flex flex-wrap gap-3 justify-center mb-8">
            <Link
              href="/play"
              className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-semibold transition-colors"
            >
              Play NBA grid
            </Link>
            <Link
              href="/crews"
              className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl font-semibold transition-colors"
            >
              My Crews
            </Link>
            <Link
              href="/profile"
              className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl font-semibold transition-colors"
            >
              Profile
            </Link>
          </div>
          <SignOutButton />
        </>
      ) : (
        <>
          <p className="text-gray-400 text-lg mb-8">Daily sports trivia grid — coming soon</p>
          <Link
            href="/auth"
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-semibold transition-colors"
          >
            Sign up / Log in
          </Link>
        </>
      )}
    </main>
  )
}
