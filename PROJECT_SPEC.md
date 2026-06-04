# Gridlore — Project Spec

A daily sports trivia grid game (in the spirit of Immaculate Grid) with a strong social layer. Built **web-first** on a $0/month free-tier stack, mobile app later.

---

## The core game

A 3×3 grid. Each of the three columns and three rows is a team. Each of the nine cells is the intersection of one row team and one column team. The player fills a cell by naming an athlete who played for **both** of those teams.

- **9 guesses total.** Every submission — right or wrong — costs one guess.
- **Free-text entry.** The player can type any name and submit. A live autocomplete dropdown helps find players but does NOT reveal whether the player fits the cell, and does NOT show points. If the submitted player doesn't satisfy the cell, it's a miss (cell flashes red, a guess is consumed).
- **Rarity scoring.** The more obscure the player, the more points. Base points = `100 − rarity`, where rarity is a fame score (higher = more famous = fewer points). A journeyman who bounced between 8 teams scores far more than a superstar everyone names.
- **Time multiplier.** A timer starts the moment the player taps a cell (NOT at grid load — players shouldn't be punished for reading the board). Multipliers:
  - 0–5 sec → 2.0×
  - 6–10 sec → 1.5×
  - 11–20 sec → 1.25×
  - 21+ sec → 1.0× (no penalty, just no bonus)
  - Final cell score = `(100 − rarity) × multiplier`, rounded.

## Sports at launch

- **NBA** — columns and rows are NBA franchises. Legacy franchises map to current (e.g. Seattle SuperSonics → OKC Thunder, New Jersey Nets → Brooklyn).
- **Soccer** — columns are World Cup national teams, rows are Champions League / Premier League clubs. Great fit for World Cup years. Example cell: Brazil × Manchester City → Gabriel Jesus or Ederson.
- Architecture must be **multi-sport expandable** (NFL, NHL, etc. later). One home screen; the user picks a sport before playing.

## Reference apps

- Immaculate Grid (the core mechanic + rarity scoring)
- Stadium Live (the social/friend-group competition feel — this is the retention engine)
- Wordle (the shareable daily result card as an organic growth loop)

---

## Tech stack — all free tier

| Layer | Tool | Notes |
|---|---|---|
| Frontend | Next.js + Tailwind CSS | Deploy via Vercel (free, auto-deploy from GitHub) |
| Backend | Supabase | Postgres DB, auth, real-time, edge functions, cron |
| NBA data | BallDontLie API (balldontlie.io) | Free, full player career team history + stats, no key on free tier |
| Soccer data | football-data.org | Free tier 10 req/min; WC squads, UCL/PL rosters |
| Fame signal (optional) | Wikimedia pageviews API | Proxy for cultural fame, feeds rarity score |
| Notifications | Web Push API (browser-native) | Free |
| Transactional email | Resend | Free tier 3k emails/month, for magic links |

**Key data principle:** Never call the player APIs at game time. Sync nightly via a Supabase edge function (cron ~2am) into your own `players` table. The game always reads from your DB so it never depends on a third-party API being up.

---

## Database schema (Supabase / Postgres)

### profiles
- `id` uuid (PK, FK to auth.users)
- `username` text (unique)
- `avatar_url` text
- `created_at` timestamptz
- `stats` jsonb — { gridsCompleted, perfectGrids, streak, longestStreak, bestScore, rarityHunts, journeymanUsed, speedBonus, sportBreakdown: { nba, soccer } }
- `badges` text[] — earned badge IDs
- `streak_freezes` int — earned freezes that protect a streak
- Row-level security: users can read all profiles, update only their own.

### players
- `id` uuid (PK)
- `name` text
- `sport` text — 'nba' | 'soccer'
- `teams` text[] — current-franchise abbreviations
- `rarity` int — computed fame score 1–100 (higher = more famous = fewer points)
- `external_id` text — id from source API for re-sync
- `updated_at` timestamptz
- Indexed on (sport, name) and a GIN index on teams for fast cell-validity queries.

### grid_schedules
- `id` uuid (PK)
- `date` date
- `sport` text
- `col_teams` text[] (length 3)
- `row_teams` text[] (length 3)
- `status` text — 'draft' | 'live'
- Before a grid goes live, an automated check counts valid players per cell and flags any cell with < 3 valid answers. User approves from a simple admin page.

### challenges
- `id` uuid (PK)
- `code` text (unique, shareable)
- `grid_date` date, `sport` text
- `challenger_id` uuid (FK profiles)
- `challenger_score` int
- `created_at` timestamptz
- `responses` jsonb[] — { userId, score, completedAt }
- Tracks async head-to-head. W/L/T derived per user pair.

### crews
- `id` uuid (PK)
- `name` text
- `invite_code` text (unique)
- `owner_id` uuid (FK profiles)
- `created_at` timestamptz

### crew_members
- `crew_id` uuid (FK crews)
- `user_id` uuid (FK profiles)
- `joined_at` timestamptz
- PK (crew_id, user_id)

### crew_scores
- `crew_id` uuid
- `user_id` uuid
- `week_start` date — for weekly leaderboard reset
- `weekly_score` int
- `season_month` text — e.g. '2026-06', for monthly season trophies
- `season_score` int

---

## Gamification (build priority order)

### 1. Crews + crew leaderboard (HIGHEST PRIORITY — the Stadium Live hook)
Build this before the global leaderboard. The global board is anonymous and cold; crews are 8 friends already trash-talking in a group chat.
- User creates a crew → gets an invite link/code → shares it.
- Crew leaderboard resets weekly: rank, score, sport icons played, streak flame.
- Shareable daily result card (see below) designed to be dropped in a group chat.

### 2. Shareable result card (THE GROWTH ENGINE)
Wordle grew entirely on its share block. Build the Gridlore equivalent early.
- A grid of colored squares showing which cells were rare vs obvious answers, plus score and streak.
- Looks good pasted in iMessage; makes non-players ask "what is that?"

### 3. Streak mechanics (best daily-retention driver)
- Streak freeze: earn one every 7 days, protects the streak if a day is missed.
- At-risk push notification at ~8pm: "Your 14-day streak ends in 4 hours."
- Crew streak alerts: "3 of your crew are on 5+ day streaks. You're not."
- Milestone badges at 7 / 30 / 100 days.

### 4. Head-to-head challenges
- W/L/T record tracked per user pair, shown on profiles, split by sport.
- Pending-challenge banner on the homepage with countdown.
- Last-10 H2H history.

### 5. Season trophies (long-term goals)
- Monthly seasons. Supabase scheduled function resets scores and awards trophies on the 1st.
- Season MVP (highest monthly crew score — permanent profile trophy).
- Sport Specialist (highest single-sport monthly score).
- Deep Cut award (lowest average rarity = most obscure answers).

### 6. Web push notifications (makes a web app feel like an app)
- 9am: "Today's NBA grid is up. Your crew is waiting."
- 8pm streak-at-risk.
- "Marcus just scored 287 on today's soccer grid."
- Immediate push on challenge received.

### Badges (current set, extend freely)
First Bucket (first grid), Immaculate (all 9), Rarity Hunter (use rarity < 50), Speed Demon (hit a 2× multiplier), On Fire (3-day streak), Locked In (7-day streak), Utility Player (grids in 2 sports), Social Butterfly (beat a friend H2H), Obscure Master (score > 400 in one grid), Trivia God (30 grids), Journeyman (use a 5+ team player), World Cup Brain (complete a soccer grid).

---

## Rarity score algorithm (replace hardcoded numbers)

Compute a fame score per player and store it in the `players.rarity` column; recompute monthly.
- Career production (NBA: PPG; Soccer: goals/apps) — higher production → higher rarity number → fewer points.
- All-Star selections / national-team caps — binary flags that add fame weight.
- Optional: Wikipedia pageviews (Wikimedia API) — strong proxy for cultural fame.
- Normalize to 1–100. Base cell points = `100 − rarity`.

---

## Build order (≈7 weeks to soft launch)

1. **Week 1–2:** Supabase auth (email + Google OAuth) + user profiles.
2. **Week 3–4:** Player DB nightly sync (BallDontLie + football-data) + grid scheduler + admin approval page + cell-validity check.
3. **Week 5–6:** Crews + crew leaderboard + shareable result card.
4. **Week 7:** Web push + streak mechanics + H2H challenges. Then soft launch.

## First Claude Code prompt (paste this)

> I'm building Gridlore, a daily sports trivia grid game (like Immaculate Grid) with a social layer. Stack: Next.js + Tailwind, Supabase for auth/database/edge functions, deploying to Vercel. I have a Supabase project and an empty GitHub repo called gridlore. Read PROJECT_SPEC.md in this repo for full context. Scaffold a fresh Next.js app, install and configure Supabase, set up email + Google auth, and create the database tables defined in the spec. Walk me through it step by step — I'm a product manager, not an engineer, so explain what each step does.

## Open questions to resolve in Claude Code

- Email/password first, or wire Google OAuth from day one? (Email is simpler to ship; Google converts better.)
- Confirm the Supabase project URL + anon key + service_role key are saved.
- Decide the daily-reset time zone for "today's grid" (Immaculate Grid uses 9am ET).
