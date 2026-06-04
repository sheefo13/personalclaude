-- Tracks resumable progress of the nightly player sync so each run can pick
-- up where the last one stopped (season + pagination cursor).
create table public.sync_state (
  id text primary key,            -- e.g. 'nba'
  season int not null,            -- season currently being swept
  cursor int,                     -- BallDontLie pagination cursor (null = start)
  updated_at timestamptz default now()
);

alter table public.sync_state enable row level security;
-- No public policies: only the service_role key (which bypasses RLS) touches this.

-- Needed so the sync can upsert players by their source id.
-- A plain (non-partial) unique constraint so it can be an ON CONFLICT target.
-- NULL external_id values remain allowed (Postgres treats NULLs as distinct).
alter table public.players
  add constraint players_sport_external_id_key unique (sport, external_id);
