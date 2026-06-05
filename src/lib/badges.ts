// Badge definitions. id must match what's stored in profiles.badges text[].
export interface BadgeDef {
  id: string
  name: string
  description: string
  emoji: string
}

export const BADGES: BadgeDef[] = [
  { id: 'first_bucket',    emoji: '🏀', name: 'First Bucket',    description: 'Complete your first grid' },
  { id: 'immaculate',      emoji: '💎', name: 'Immaculate',      description: 'Fill all 9 cells correctly' },
  { id: 'on_fire',         emoji: '🔥', name: 'On Fire',         description: 'Reach a 3-day streak' },
  { id: 'locked_in',       emoji: '🔒', name: 'Locked In',       description: 'Reach a 7-day streak' },
  { id: 'century',         emoji: '💯', name: 'Century',         description: 'Reach a 100-day streak' },
  { id: 'trivia_god',      emoji: '🧠', name: 'Trivia God',      description: 'Complete 30 grids' },
  { id: 'rarity_hunter',   emoji: '🔍', name: 'Rarity Hunter',   description: 'Answer with a deep-cut player (rarity < 35)' },
  { id: 'speed_demon',     emoji: '⚡', name: 'Speed Demon',     description: 'Answer a cell in under 5 seconds (2× bonus)' },
  { id: 'obscure_master',  emoji: '🎯', name: 'Obscure Master',  description: 'Score over 400 points in one grid' },
  { id: 'journeyman',      emoji: '✈️', name: 'Journeyman',      description: 'Use a player who played for 5+ teams' },
  { id: 'social_butterfly',emoji: '🦋', name: 'Social Butterfly', description: 'Beat a friend in a head-to-head challenge' },
  { id: 'utility_player',  emoji: '🌍', name: 'Utility Player',  description: 'Complete grids in 2 different sports' },
]

export const BADGE_MAP = Object.fromEntries(BADGES.map((b) => [b.id, b]))

export interface GameSummary {
  score: number
  filled: number           // cells correctly filled (0-9)
  cellResults: Array<{
    rarity: number
    points: number
    basePoints: number     // 100 - rarity (used to detect speed bonus)
    teamCount: number      // how many teams the player has played for
  }>
  sport: string
  streak: number           // streak AFTER this game is counted
  gridsCompleted: number   // total AFTER this game
}

export function computeNewBadges(
  existing: string[],
  summary: GameSummary
): string[] {
  const has = new Set(existing)
  const earned: string[] = []

  function award(id: string) {
    if (!has.has(id)) { has.add(id); earned.push(id) }
  }

  if (summary.gridsCompleted >= 1)  award('first_bucket')
  if (summary.filled === 9)         award('immaculate')
  if (summary.streak >= 3)          award('on_fire')
  if (summary.streak >= 7)          award('locked_in')
  if (summary.streak >= 100)        award('century')
  if (summary.gridsCompleted >= 30) award('trivia_god')
  if (summary.score > 400)          award('obscure_master')

  for (const c of summary.cellResults) {
    if (c.rarity < 35)             award('rarity_hunter')
    if (c.points > c.basePoints * 1.9) award('speed_demon') // 2× multiplier
    if (c.teamCount >= 5)          award('journeyman')
  }

  if (summary.sport !== 'nba')     award('utility_player')

  return earned
}
