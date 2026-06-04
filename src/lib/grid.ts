// Pure helpers for grid validity, generation, and scoring.

export interface PlayerLite {
  name: string
  teams: string[]
  rarity: number
}

export interface Grid {
  date: string
  sport: string
  colTeams: string[]
  rowTeams: string[]
}

// Does any player satisfy the intersection of two teams?
export function cellHasAnswer(
  players: PlayerLite[],
  teamA: string,
  teamB: string
): boolean {
  return players.some(
    (p) => p.teams.includes(teamA) && p.teams.includes(teamB)
  )
}

// Find a valid player for a cell (used to validate a guess server-side).
export function findAnswer(
  players: PlayerLite[],
  name: string,
  rowTeam: string,
  colTeam: string
): PlayerLite | null {
  const target = name.trim().toLowerCase()
  return (
    players.find(
      (p) =>
        p.name.toLowerCase() === target &&
        p.teams.includes(rowTeam) &&
        p.teams.includes(colTeam)
    ) ?? null
  )
}

// Time multiplier per the spec.
export function timeMultiplier(elapsedSec: number): number {
  if (elapsedSec <= 5) return 2.0
  if (elapsedSec <= 10) return 1.5
  if (elapsedSec <= 20) return 1.25
  return 1.0
}

export function scoreCell(rarity: number, elapsedSec: number): number {
  const base = 100 - rarity
  return Math.round(base * timeMultiplier(elapsedSec))
}

// Generate a grid where all 9 cells have at least one valid answer.
// Tries random team combinations until one fully works.
export function generateGrid(
  players: PlayerLite[],
  attempts = 500
): { colTeams: string[]; rowTeams: string[] } | null {
  const teams = [...new Set(players.flatMap((p) => p.teams))]

  for (let i = 0; i < attempts; i++) {
    const picked = shuffle(teams).slice(0, 6)
    const rowTeams = picked.slice(0, 3)
    const colTeams = picked.slice(3, 6)

    const allValid = rowTeams.every((rt) =>
      colTeams.every((ct) => cellHasAnswer(players, rt, ct))
    )
    if (allValid) return { rowTeams, colTeams }
  }
  return null
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
