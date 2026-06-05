export interface StreakState {
  streak: number
  longestStreak: number
  streakFreezes: number
  lastPlayedDate: string | null // YYYY-MM-DD UTC
}

export interface StreakUpdate {
  streak: number
  longestStreak: number
  streakFreezes: number
  lastPlayedDate: string
  usedFreeze: boolean
  alreadyPlayedToday: boolean
}

export function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000
  )
}

// Every 7 grids completed earns a freeze. Returns how many freezes to grant.
export function freezesEarned(prevCompleted: number, newCompleted: number): number {
  return Math.floor(newCompleted / 7) - Math.floor(prevCompleted / 7)
}

export function updateStreak(state: StreakState): StreakUpdate {
  const today = todayUTC()
  const last = state.lastPlayedDate

  // Already played today — don't double-count the streak.
  if (last === today) {
    return {
      streak: state.streak,
      longestStreak: state.longestStreak,
      streakFreezes: state.streakFreezes,
      lastPlayedDate: today,
      usedFreeze: false,
      alreadyPlayedToday: true,
    }
  }

  let streak = state.streak
  let streakFreezes = state.streakFreezes
  let usedFreeze = false

  if (!last) {
    // First ever game.
    streak = 1
  } else {
    const gap = daysBetween(last, today)
    if (gap === 1) {
      // Consecutive day — extend streak.
      streak += 1
    } else if (gap === 2 && streakFreezes > 0) {
      // Missed one day but have a freeze — burn it.
      streakFreezes -= 1
      streak += 1
      usedFreeze = true
    } else {
      // Streak broken.
      streak = 1
    }
  }

  const longestStreak = Math.max(state.longestStreak, streak)

  return {
    streak,
    longestStreak,
    streakFreezes,
    lastPlayedDate: today,
    usedFreeze,
    alreadyPlayedToday: false,
  }
}
