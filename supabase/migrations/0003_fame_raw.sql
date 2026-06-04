-- Stores each player's raw Wikipedia pageview total (a fame signal) before it
-- is normalised into the 1-100 rarity score.
alter table public.players add column if not exists fame_raw bigint;
