-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- profiles
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null,
  avatar_url text,
  created_at timestamptz default now(),
  stats jsonb default '{
    "gridsCompleted": 0,
    "perfectGrids": 0,
    "streak": 0,
    "longestStreak": 0,
    "bestScore": 0,
    "rarityHunts": 0,
    "journeymanUsed": 0,
    "speedBonus": 0,
    "sportBreakdown": { "nba": 0, "soccer": 0 }
  }'::jsonb,
  badges text[] default '{}',
  streak_freezes int default 0
);

alter table public.profiles enable row level security;
create policy "Public profiles are viewable by everyone" on public.profiles for select using (true);
create policy "Users can update their own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert their own profile" on public.profiles for insert with check (auth.uid() = id);

-- players
create table public.players (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  sport text not null check (sport in ('nba', 'soccer')),
  teams text[] not null default '{}',
  rarity int not null check (rarity between 1 and 100),
  external_id text,
  updated_at timestamptz default now()
);

create index players_sport_name_idx on public.players (sport, name);
create index players_teams_gin_idx on public.players using gin (teams);

alter table public.players enable row level security;
create policy "Players are viewable by everyone" on public.players for select using (true);

-- grid_schedules
create table public.grid_schedules (
  id uuid primary key default uuid_generate_v4(),
  date date not null,
  sport text not null check (sport in ('nba', 'soccer')),
  col_teams text[] not null,
  row_teams text[] not null,
  status text not null default 'draft' check (status in ('draft', 'live')),
  constraint col_teams_length check (array_length(col_teams, 1) = 3),
  constraint row_teams_length check (array_length(row_teams, 1) = 3),
  unique (date, sport)
);

alter table public.grid_schedules enable row level security;
create policy "Live grids are viewable by everyone" on public.grid_schedules for select using (status = 'live');

-- challenges
create table public.challenges (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null,
  grid_date date not null,
  sport text not null,
  challenger_id uuid references public.profiles(id) on delete cascade,
  challenger_score int not null,
  created_at timestamptz default now(),
  responses jsonb[] default '{}'
);

alter table public.challenges enable row level security;
create policy "Challenges viewable by everyone" on public.challenges for select using (true);
create policy "Authenticated users can create challenges" on public.challenges for insert with check (auth.role() = 'authenticated');

-- crews
create table public.crews (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  invite_code text unique not null,
  owner_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz default now()
);

alter table public.crews enable row level security;
create policy "Crews viewable by everyone" on public.crews for select using (true);
create policy "Authenticated users can create crews" on public.crews for insert with check (auth.role() = 'authenticated');

-- crew_members
create table public.crew_members (
  crew_id uuid references public.crews(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (crew_id, user_id)
);

alter table public.crew_members enable row level security;
create policy "Crew members viewable by everyone" on public.crew_members for select using (true);
create policy "Users can join crews" on public.crew_members for insert with check (auth.uid() = user_id);
create policy "Users can leave crews" on public.crew_members for delete using (auth.uid() = user_id);

-- crew_scores
create table public.crew_scores (
  crew_id uuid references public.crews(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  week_start date not null,
  weekly_score int default 0,
  season_month text not null,
  season_score int default 0,
  primary key (crew_id, user_id, week_start)
);

alter table public.crew_scores enable row level security;
create policy "Crew scores viewable by everyone" on public.crew_scores for select using (true);

-- Function to auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
