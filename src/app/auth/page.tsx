'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username } },
      })
      if (error) setError(error.message)
      else if (data.session) {
        // Email confirmation is off — user is logged in immediately.
        router.push('/')
        router.refresh()
      } else {
        setMessage('Check your email to confirm your account.')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else {
        router.push('/')
        router.refresh()
      }
    }
    setLoading(false)
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
      <div className="w-full max-w-md p-8 bg-gray-900 rounded-2xl shadow-xl">
        <h1 className="text-3xl font-bold text-center mb-2">Gridlore</h1>
        <p className="text-center text-gray-400 mb-8">Daily sports trivia grid</p>

        <div className="flex rounded-lg overflow-hidden mb-6 border border-gray-700">
          <button
            className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === 'login' ? 'bg-indigo-600' : 'bg-gray-800 text-gray-400'}`}
            onClick={() => setMode('login')}
          >Log in</button>
          <button
            className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === 'signup' ? 'bg-indigo-600' : 'bg-gray-800 text-gray-400'}`}
            onClick={() => setMode('signup')}
          >Sign up</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:border-indigo-500"
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:border-indigo-500"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:border-indigo-500"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          {message && <p className="text-green-400 text-sm">{message}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-semibold transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading...' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>
      </div>
    </main>
  )
}
