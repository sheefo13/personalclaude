'use client'

import { useState, useCallback } from 'react'

export default function EnrichPage() {
  const [secret, setSecret] = useState('')
  const [running, setRunning] = useState(false)
  const [processed, setProcessed] = useState(0)
  const [total, setTotal] = useState(0)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [log, setLog] = useState<string[]>([])

  const addLog = (msg: string) => setLog((l) => [`${new Date().toLocaleTimeString()} ${msg}`, ...l.slice(0, 49)])

  const runStep = useCallback(async (currentSecret: string): Promise<void> => {
    try {
      const res = await fetch(`/api/enrich/rarity?secret=${encodeURIComponent(currentSecret)}`)
      const data = await res.json()

      if (!res.ok || data.error) {
        setError(data.error ?? `HTTP ${res.status}`)
        setRunning(false)
        return
      }

      if (data.complete) {
        setDone(true)
        setRunning(false)
        addLog(`✅ Complete! Ranked ${data.totalRanked ?? '?'} players.`)
        return
      }

      setProcessed(data.processed ?? 0)
      setTotal(data.total ?? 0)
      addLog(`Enriched ${data.processed}/${data.total} players…`)

      // Tiny pause so the browser stays responsive, then continue.
      await new Promise((r) => setTimeout(r, 300))
      await runStep(currentSecret)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setRunning(false)
    }
  }, [])

  function start() {
    if (!secret.trim()) return
    setRunning(true)
    setDone(false)
    setError(null)
    setLog([])
    setProcessed(0)
    addLog('Starting rarity enrichment…')
    runStep(secret.trim())
  }

  const pct = total > 0 ? Math.round((processed / total) * 100) : 0

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8 flex flex-col items-center">
      <div className="w-full max-w-lg">
        <h1 className="text-2xl font-bold mb-1">Rarity Enrichment</h1>
        <p className="text-gray-400 text-sm mb-6">
          Fetches Wikipedia pageviews for every player and computes real rarity scores.
          Leave this tab open — it runs automatically until complete.
        </p>

        {!running && !done && (
          <div className="flex gap-3 mb-6">
            <input
              type="text"
              placeholder="CRON_SECRET value"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              className="flex-1 px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={start}
              disabled={!secret.trim()}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-semibold disabled:opacity-40"
            >
              Start
            </button>
          </div>
        )}

        {(running || done) && (
          <div className="mb-6">
            <div className="flex justify-between text-sm mb-1">
              <span>{done ? '✅ Complete!' : `${processed} / ${total} players`}</span>
              <span>{done ? '100' : pct}%</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-4 overflow-hidden">
              <div
                className="h-4 bg-indigo-500 transition-all duration-300"
                style={{ width: `${done ? 100 : pct}%` }}
              />
            </div>
            {done && (
              <p className="text-green-400 mt-3 font-semibold">
                All rarity scores updated! Real scoring is now live in the game.
              </p>
            )}
          </div>
        )}

        {error && (
          <div className="mb-4 p-4 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">
            <b>Error:</b> {error}
            <button
              onClick={start}
              className="ml-4 underline hover:no-underline"
            >Resume</button>
          </div>
        )}

        {log.length > 0 && (
          <div className="bg-gray-900 rounded-lg p-4 text-xs text-gray-400 max-h-60 overflow-y-auto font-mono">
            {log.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        )}
      </div>
    </main>
  )
}
