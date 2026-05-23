-- v2.0 — persist strength sessions with per-exercise detail.
--
-- Two tables. strength_sessions is one row per workout the user logged.
-- strength_session_exercises is one row per exercise WITHIN that session,
-- with `sets` as a jsonb array — keeps the row count down while still
-- letting us query "all bench press sessions" cheaply via a name index.
--
-- Run this once in Supabase SQL Editor before shipping v2.0.

-- ── strength_sessions ────────────────────────────────────────────────────────
create table if not exists public.strength_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  -- Loose link to the local log entry (so the Activities feed can stitch
  -- the session id back onto the right card). Stored as text since local
  -- log ids can be number-ish.
  log_id        text,
  started_at    timestamptz not null,
  duration_sec  integer not null default 0,
  calories      integer,
  routine_name  text,
  notes         text,
  created_at    timestamptz not null default now()
);

alter table public.strength_sessions enable row level security;

drop policy if exists "Users can read own strength sessions"  on public.strength_sessions;
drop policy if exists "Users can write own strength sessions" on public.strength_sessions;
drop policy if exists "Users can update own strength sessions" on public.strength_sessions;
drop policy if exists "Users can delete own strength sessions" on public.strength_sessions;

create policy "Users can read own strength sessions"
  on public.strength_sessions for select
  using (auth.uid() = user_id);

create policy "Users can write own strength sessions"
  on public.strength_sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own strength sessions"
  on public.strength_sessions for update
  using (auth.uid() = user_id);

create policy "Users can delete own strength sessions"
  on public.strength_sessions for delete
  using (auth.uid() = user_id);

create index if not exists strength_sessions_user_started_idx
  on public.strength_sessions (user_id, started_at desc);

-- ── strength_session_exercises ───────────────────────────────────────────────
-- One row per exercise inside a session. `sets` is jsonb array:
--   [{ "reps": 8, "weight": 60 }, { "reps": 6, "weight": 65 }, ...]
-- Tempo / rest / RPE can be added to each set object without a migration.
create table if not exists public.strength_session_exercises (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.strength_sessions(id) on delete cascade,
  ordinal         smallint not null,
  exercise_name   text not null,
  sets            jsonb not null default '[]',
  notes           text,
  created_at      timestamptz not null default now()
);

alter table public.strength_session_exercises enable row level security;

drop policy if exists "Read own session exercises"   on public.strength_session_exercises;
drop policy if exists "Write own session exercises"  on public.strength_session_exercises;
drop policy if exists "Update own session exercises" on public.strength_session_exercises;
drop policy if exists "Delete own session exercises" on public.strength_session_exercises;

-- The owning session must belong to the current user.
create policy "Read own session exercises"
  on public.strength_session_exercises for select
  using (exists (
    select 1 from public.strength_sessions s
    where s.id = session_id and s.user_id = auth.uid()
  ));

create policy "Write own session exercises"
  on public.strength_session_exercises for insert
  with check (exists (
    select 1 from public.strength_sessions s
    where s.id = session_id and s.user_id = auth.uid()
  ));

create policy "Update own session exercises"
  on public.strength_session_exercises for update
  using (exists (
    select 1 from public.strength_sessions s
    where s.id = session_id and s.user_id = auth.uid()
  ));

create policy "Delete own session exercises"
  on public.strength_session_exercises for delete
  using (exists (
    select 1 from public.strength_sessions s
    where s.id = session_id and s.user_id = auth.uid()
  ));

create index if not exists strength_session_exercises_session_idx
  on public.strength_session_exercises (session_id, ordinal);

create index if not exists strength_session_exercises_name_idx
  on public.strength_session_exercises (exercise_name);
