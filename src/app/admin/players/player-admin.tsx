'use client'

import { useState, useCallback } from 'react'

const NBA_TEAMS = [
  'ATL','BOS','BKN','CHA','CHI','CLE','DAL','DEN','DET','GSW',
  'HOU','IND','LAC','LAL','MEM','MIA','MIL','MIN','NOP','NYK',
  'OKC','ORL','PHI','PHX','POR','SAC','SAS','TOR','UTA','WAS',
]

interface Player {
  id: string
  name: string
  sport: string
  teams: string[]
  rarity: number
  external_id: string | null
}

export default function PlayerAdmin() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Player[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<Player | null>(null)
  const [editTeams, setEditTeams] = useState<string[]>([])
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  // Add new player form
  const [newName, setNewName] = useState('')
  const [newTeams, setNewTeams] = useState<string[]>([])
  const [adding, setAdding] = useState(false)

  const search = useCallback(async (value: string) => {
    setQ(value)
    if (value.length < 2) { setResults([]); return }
    setLoading(true)
    const res = await fetch(`/api/admin/players?q=${encodeURIComponent(value)}&sport=nba`)
    const data = await res.json()
    setResults(data.players ?? [])
    setLoading(false)
  }, [])

  function startEdit(player: Player) {
    setEditing(player)
    setEditTeams([...player.teams])
    setEditName(player.name)
    setMsg(null)
  }

  function toggleTeam(abbr: string, list: string[], setList: (t: string[]) => void) {
    setList(list.includes(abbr) ? list.filter(t => t !== abbr) : [...list, abbr])
  }

  async function saveEdit() {
    if (!editing) return
    setSaving(true)
    const res = await fetch(`/api/admin/players/${editing.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName, teams: editTeams }),
    })
    const data = await res.json()
    setSaving(false)
    if (res.ok) {
      setMsg({ text: 'Saved!', ok: true })
      setResults(results.map(p => p.id === editing.id ? { ...p, name: editName, teams: editTeams } : p))
      setEditing(null)
    } else {
      setMsg({ text: data.error ?? 'Save failed', ok: false })
    }
  }

  async function deletePlayer(player: Player) {
    if (!confirm(`Delete ${player.name}?`)) return
    const res = await fetch(`/api/admin/players/${player.id}`, { method: 'DELETE' })
    if (res.ok) {
      setResults(results.filter(p => p.id !== player.id))
      if (editing?.id === player.id) setEditing(null)
    }
  }

  async function addPlayer() {
    if (!newName.trim() || newTeams.length === 0) return
    setAdding(true)
    const res = await fetch('/api/admin/players', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), sport: 'nba', teams: newTeams }),
    })
    const data = await res.json()
    setAdding(false)
    if (res.ok) {
      setMsg({ text: `${newName} ${data.action === 'updated' ? 'updated' : 'added'}! Teams: ${data.teams?.join(', ') ?? newTeams.join(', ')}`, ok: true })
      setNewName('')
      setNewTeams([])
      // Refresh search if query is active
      if (q.length >= 2) search(q)
    } else {
      setMsg({ text: data.error ?? 'Failed', ok: false })
    }
  }

  return (
    <div className="space-y-8">
      {msg && (
        <div className={`px-4 py-3 rounded-xl text-sm font-medium ${msg.ok ? 'bg-green-900/40 border border-green-700 text-green-300' : 'bg-red-900/40 border border-red-700 text-red-300'}`}>
          {msg.text}
        </div>
      )}

      {/* Add / fix a player */}
      <div className="bg-gray-900 rounded-2xl p-5">
        <h2 className="font-bold text-lg mb-4">Add or Fix a Player</h2>
        <p className="text-gray-400 text-sm mb-4">
          If a player is missing or has wrong teams, fill this in. If they already exist, their teams will be merged with what you enter here.
        </p>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider block mb-1">Player name</label>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="e.g. Terry Rozier"
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">Teams (select all that apply)</label>
            <div className="flex flex-wrap gap-2">
              {NBA_TEAMS.map(abbr => (
                <button
                  key={abbr}
                  onClick={() => toggleTeam(abbr, newTeams, setNewTeams)}
                  className={`px-3 py-1 rounded-lg text-sm font-mono font-semibold transition-colors ${
                    newTeams.includes(abbr)
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {abbr}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={addPlayer}
            disabled={adding || !newName.trim() || newTeams.length === 0}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl font-semibold transition-colors"
          >
            {adding ? 'Saving…' : 'Save Player'}
          </button>
        </div>
      </div>

      {/* Search & edit existing */}
      <div className="bg-gray-900 rounded-2xl p-5">
        <h2 className="font-bold text-lg mb-4">Search & Edit Existing Players</h2>
        <input
          value={q}
          onChange={e => search(e.target.value)}
          placeholder="Type a name to search…"
          className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 mb-4"
        />
        {loading && <p className="text-gray-500 text-sm">Searching…</p>}
        <div className="space-y-2">
          {results.map(player => (
            <div key={player.id}>
              <div
                className={`flex items-center justify-between rounded-xl px-4 py-3 cursor-pointer transition-colors ${
                  editing?.id === player.id ? 'bg-indigo-900/40 border border-indigo-600' : 'bg-gray-800 hover:bg-gray-750 border border-gray-700'
                }`}
                onClick={() => editing?.id === player.id ? setEditing(null) : startEdit(player)}
              >
                <div>
                  <p className="font-semibold">{player.name}</p>
                  <p className="text-xs text-gray-400 font-mono">{player.teams.join(' · ')}</p>
                </div>
                <div className="flex gap-2">
                  <span className="text-xs text-gray-500">{player.teams.length} teams</span>
                  <button
                    onClick={e => { e.stopPropagation(); deletePlayer(player) }}
                    className="text-red-500 hover:text-red-400 text-xs px-2"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {editing?.id === player.id && (
                <div className="bg-gray-800 rounded-xl px-4 py-4 mt-1 space-y-3 border border-indigo-700">
                  <div>
                    <label className="text-xs text-gray-400 uppercase tracking-wider block mb-1">Name</label>
                    <input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">Teams</label>
                    <div className="flex flex-wrap gap-2">
                      {NBA_TEAMS.map(abbr => (
                        <button
                          key={abbr}
                          onClick={() => toggleTeam(abbr, editTeams, setEditTeams)}
                          className={`px-3 py-1 rounded-lg text-sm font-mono font-semibold transition-colors ${
                            editTeams.includes(abbr)
                              ? 'bg-indigo-600 text-white'
                              : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                          }`}
                        >
                          {abbr}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={saveEdit}
                      disabled={saving}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg font-semibold text-sm transition-colors"
                    >
                      {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                    <button
                      onClick={() => setEditing(null)}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold text-sm transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {results.length === 0 && q.length >= 2 && !loading && (
            <p className="text-gray-500 text-sm">No players found — use the form above to add them.</p>
          )}
        </div>
      </div>
    </div>
  )
}
