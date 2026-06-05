'use client'

import { useState } from 'react'

interface Props {
  score: number
  sport: string
}

type State = 'idle' | 'loading' | 'created'

export default function ChallengeButton({ score, sport }: Props) {
  const [state, setState] = useState<State>('idle')
  const [challengeUrl, setChallengeUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function createChallenge() {
    setState('loading')
    setError(null)
    try {
      const res = await fetch('/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score, sport }),
      })
      const data = await res.json()
      if (data.url) {
        setChallengeUrl(data.url)
        setState('created')
      } else {
        setError(data.error ?? 'Failed to create challenge')
        setState('idle')
      }
    } catch {
      setError('Network error')
      setState('idle')
    }
  }

  async function copyUrl() {
    if (!challengeUrl) return
    try {
      await navigator.clipboard.writeText(challengeUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      prompt('Copy this link:', challengeUrl)
    }
  }

  if (state === 'created' && challengeUrl) {
    return (
      <div className="space-y-2">
        <div className="bg-gray-800 rounded-xl px-4 py-3 text-sm text-gray-300 break-all">
          {challengeUrl}
        </div>
        <button
          onClick={copyUrl}
          className="w-full py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-semibold transition-colors"
        >
          {copied ? '✓ Link copied!' : '📋 Copy challenge link'}
        </button>
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={createChallenge}
        disabled={state === 'loading'}
        className="w-full py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-semibold transition-colors disabled:opacity-50"
      >
        {state === 'loading' ? 'Creating…' : '🆚 Challenge a friend'}
      </button>
      {error && <p className="text-red-400 text-xs mt-1 text-center">{error}</p>}
    </div>
  )
}
