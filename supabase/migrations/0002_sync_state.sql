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

-- Needed so the sync can upsert players by their source-API id.
create unique index players_sport_external_id_idx
  on public.players (sport, external_id)
  where external_id is not null;
