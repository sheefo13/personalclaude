import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from './sign-out-button'

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let username: string | null = null
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single()
    username = profile?.username ?? user.email ?? null
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-950 text-white">
      <h1 className="text-5xl font-bold mb-4">Gridlore</h1>

      {user ? (
        <>
          <p className="text-gray-300 text-lg mb-2">
            Welcome back, <span className="font-semibold">{username}</span> 👋
          </p>
          <p className="text-gray-500 text-sm mb-8">
            Ready to play today&apos;s grid?
          </p>
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
