-- Run Activities table — stores GPS-tracked runs (and walks/cycles) with full
-- path data for the post-run Summary screen + history.
--
-- Run this in Supabase Dashboard → SQL Editor → New query, then "Run".

create table if not exists public.run_activities (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade,

  activity_type            text not null default 'run',   -- 'run' | 'walk' | 'cycle'
  started_at               timestamptz not null,
  duration_sec             integer not null,
  distance_km              numeric(8,3) not null,

  avg_pace_min_per_km      numeric(6,2),
  max_pace_min_per_km      numeric(6,2),                  -- best (lowest) pace observed
  elevation_gain_m         integer,
  calories                 integer,

  -- JSONB blobs:
  --   path: [{ lat, lng, alt, ts }] — every GPS point captured
  --   splits: [{ km, time_sec, pace }] — per-kilometre breakdown
  path                     jsonb not null default '[]'::jsonb,
  splits                   jsonb not null default '[]'::jsonb,

  ai_insights              text,
  created_at               timestamptz not null default now()
);

-- Fast lookup of a user's runs in date order
create index if not exists run_activities_user_started_idx
  on public.run_activities (user_id, started_at desc);

-- ── Row-Level Security ──────────────────────────────────────────────────────
alter table public.run_activities enable row level security;

drop policy if exists "Users can read own run activities"   on public.run_activities;
drop policy if exists "Users can insert own run activities" on public.run_activities;
drop policy if exists "Users can update own run activities" on public.run_activities;
drop policy if exists "Users can delete own run activities" on public.run_activities;

create policy "Users can read own run activities"
  on public.run_activities for select using (auth.uid() = user_id);

create policy "Users can insert own run activities"
  on public.run_activities for insert with check (auth.uid() = user_id);

create policy "Users can update own run activities"
  on public.run_activities for update using (auth.uid() = user_id);

create policy "Users can delete own run activities"
  on public.run_activities for delete using (auth.uid() = user_id);
