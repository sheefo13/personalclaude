'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

interface CellResult {
  correct: true
  playerName: string
  points: number
  rarity: number
}

interface Props {
  rowTeams: string[]
  colTeams: string[]
}

const TOTAL_GUESSES = 9

function rarityEmoji(rarity: number): string {
  if (rarity < 35) return '🟦' // obscure — big points
  if (rarity < 65) return '🟩' // solid pick
  return '🟨'                  // obvious — everyone named them
}

function rarityLabel(rarity: number): string {
  if (rarity < 35) return 'Deep cut'
  if (rarity < 65) return 'Solid'
  return 'Obvious'
}

function buildShareText(
  rowTeams: string[],
  colTeams: string[],
  results: Record<string, CellResult>,
  score: number,
  guessesUsed: number
): string {
  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const filled = Object.keys(results).length

  const rows = rowTeams.map((_, r) =>
    colTeams.map((__, c) => {
      const result = results[`${r}-${c}`]
      return result ? rarityEmoji(result.rarity) : '⬛'
    }).join('')
  ).join('\n')

  return [
    `Gridlore NBA 🏀 · ${date}`,
    `${colTeams.join(' · ')}`,
    `${rowTeams.join(' · ')}`,
    '',
    rows,
    '',
    `Score: ${score} · ${filled}/9 cells · ${guessesUsed} guesses`,
    'gridlore.vercel.app',
  ].join('\n')
}

export default function Game({ rowTeams, colTeams }: Props) {
  const [results, setResults] = useState<Record<string, CellResult>>({})
  const [guessesLeft, setGuessesLeft] = useState(TOTAL_GUESSES)
  const [active, setActive] = useState<{ r: number; c: number } | null>(null)
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [flashWrong, setFlashWrong] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)
  const cellStart = useRef<number>(0)

  const score = Object.values(results).reduce((s, r) => s + r.points, 0)
  const filled = Object.keys(results).length
  const guessesUsed = TOTAL_GUESSES - guessesLeft
  const gameOver = guessesLeft <= 0 || filled >= 9

  function openCell(r: number, c: number) {
    if (gameOver) return
    if (results[`${r}-${c}`]) return
    setActive({ r, c })
    setInput('')
    setSuggestions([])
    cellStart.current = Date.now()
  }

  useEffect(() => {
    if (input.trim().length < 2) { setSuggestions([]); return }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/players/search?q=${encodeURIComponent(input)}`)
      const data = await res.json()
      setSuggestions(data.players ?? [])
    }, 150)
    return () => clearTimeout(t)
  }, [input])

  async function submitGuess(name: string) {
    if (!active || submitting || !name.trim()) return
    setSubmitting(true)
    const elapsedSec = (Date.now() - cellStart.current) / 1000

    const res = await fetch('/api/grid/guess', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rowTeam: rowTeams[active.r],
        colTeam: colTeams[active.c],
        name,
        elapsedSec,
      }),
    })
    const data = await res.json()
    setGuessesLeft((g) => g - 1)

    if (data.correct) {
      setResults((prev) => ({
        ...prev,
        [`${active.r}-${active.c}`]: {
          correct: true,
          playerName: data.playerName,
          points: data.points,
          rarity: data.rarity,
        },
      }))
      setActive(null)
      setInput('')
      setSuggestions([])
    } else {
      setFlashWrong(true)
      setTimeout(() => setFlashWrong(false), 500)
    }
    setSubmitting(false)
  }

  async function share() {
    const text = buildShareText(rowTeams, colTeams, results, score, guessesUsed)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Fallback for browsers that block clipboard without interaction
      prompt('Copy this and share it:', text)
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-4 flex flex-col items-center">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <Link href="/" className="text-gray-400 hover:text-white text-sm">← Home</Link>
          <h1 className="text-xl font-bold">Gridlore · NBA</h1>
          <div className="text-sm text-right">
            <div>Score: <span className="font-bold text-indigo-400">{score}</span></div>
            <div className="text-gray-400">Guesses: {guessesLeft}</div>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-4 gap-1.5">
          <div />
          {colTeams.map((t) => (
            <div key={`col-${t}`} className="flex items-center justify-center bg-gray-800 rounded-lg py-3 font-bold text-sm">
              {t}
            </div>
          ))}
          {rowTeams.map((rt, r) => (
            <RowFragment
              key={`row-${rt}`}
              rt={rt} r={r}
              colTeams={colTeams}
              results={results}
              active={active}
              gameOver={gameOver}
              onOpen={openCell}
            />
          ))}
        </div>

        {/* Guess input */}
        {active && !gameOver && (
          <div className="mt-5 relative">
            <p className="text-sm text-gray-400 mb-1">
              Who played for both <b className="text-white">{rowTeams[active.r]}</b> and{' '}
              <b className="text-white">{colTeams[active.c]}</b>?
            </p>
            <input
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitGuess(input)}
              placeholder="Type a player's name…"
              className={`w-full px-4 py-3 rounded-lg bg-gray-800 border focus:outline-none ${
                flashWrong ? 'border-red-500 animate-pulse' : 'border-gray-700 focus:border-indigo-500'
              }`}
            />
            {suggestions.length > 0 && (
              <ul className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                {suggestions.map((s) => (
                  <li key={s}>
                    <button onClick={() => submitGuess(s)} className="w-full text-left px-4 py-2 hover:bg-gray-700">
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Game over card */}
        {gameOver && (
          <div className="mt-6 bg-gray-900 rounded-2xl p-6">

            {/* Result grid preview */}
            <div className="flex flex-col items-center mb-5">
              <p className="text-gray-400 text-xs mb-2 uppercase tracking-wider">Your result</p>
              <div className="grid grid-cols-3 gap-1.5 mb-3">
                {rowTeams.map((_, r) =>
                  colTeams.map((__, c) => {
                    const result = results[`${r}-${c}`]
                    return (
                      <div
                        key={`share-${r}-${c}`}
                        title={result ? `${result.playerName} · ${rarityLabel(result.rarity)} · +${result.points}` : 'Missed'}
                        className={`w-14 h-14 rounded-lg flex flex-col items-center justify-center text-center p-1 ${
                          !result ? 'bg-gray-800' :
                          result.rarity < 35 ? 'bg-blue-600' :
                          result.rarity < 65 ? 'bg-green-600' :
                          'bg-yellow-600'
                        }`}
                      >
                        {result ? (
                          <>
                            <span className="text-[9px] leading-tight font-medium text-white">{result.playerName}</span>
                            <span className="text-[10px] font-bold text-white/80">+{result.points}</span>
                          </>
                        ) : (
                          <span className="text-gray-600 text-xl">✕</span>
                        )}
                      </div>
                    )
                  })
                )}
              </div>

              {/* Legend */}
              <div className="flex gap-3 text-xs text-gray-400">
                <span>🟦 Deep cut</span>
                <span>🟩 Solid</span>
                <span>🟨 Obvious</span>
                <span>⬛ Missed</span>
              </div>
            </div>

            {/* Score summary */}
            <div className="text-center mb-5">
              <p className="text-4xl font-bold text-indigo-400 mb-1">{score}</p>
              <p className="text-gray-400 text-sm">{filled} of 9 cells · {guessesUsed} guesses used</p>
            </div>

            {/* Share button */}
            <button
              onClick={share}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-semibold transition-colors mb-3"
            >
              {copied ? '✓ Copied to clipboard!' : '📋 Share result'}
            </button>

            <div className="text-center">
              <Link href="/" className="text-gray-400 hover:text-white text-sm">← Back home</Link>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

function RowFragment({
  rt, r, colTeams, results, active, gameOver, onOpen,
}: {
  rt: string; r: number; colTeams: string[]
  results: Record<string, CellResult>
  active: { r: number; c: number } | null
  gameOver: boolean; onOpen: (r: number, c: number) => void
}) {
  return (
    <>
      <div className="flex items-center justify-center bg-gray-800 rounded-lg py-3 font-bold text-sm">{rt}</div>
      {colTeams.map((_, c) => {
        const key = `${r}-${c}`
        const result = results[key]
        const isActive = active?.r === r && active?.c === c
        return (
          <button
            key={key}
            onClick={() => onOpen(r, c)}
            disabled={!!result || gameOver}
            className={`aspect-square rounded-lg flex flex-col items-center justify-center text-center p-1 transition-colors ${
              result
                ? result.rarity < 35 ? 'bg-blue-700'
                  : result.rarity < 65 ? 'bg-green-700'
                  : 'bg-yellow-700'
                : isActive ? 'bg-indigo-600'
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            {result ? (
              <>
                <span className="text-[10px] leading-tight font-medium">{result.playerName}</span>
                <span className="text-xs font-bold opacity-80">+{result.points}</span>
              </>
            ) : (
              <span className="text-gray-500 text-lg">+</span>
            )}
          </button>
        )
      })}
    </>
  )
}
