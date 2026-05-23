-- v2.0 — extend run_activities with the new detail-screen columns.
--
-- All nullable, all backfill-friendly. Run this once in Supabase SQL Editor
-- before shipping the v2.0 AAB.

alter table public.run_activities
  add column if not exists notes        text,
  add column if not exists location     text,
  add column if not exists prescribed   text,
  add column if not exists shoes_id     uuid;

-- avg_hr / max_hr / cadence land here once Health Connect ships.
alter table public.run_activities
  add column if not exists avg_hr_bpm   smallint,
  add column if not exists max_hr_bpm   smallint,
  add column if not exists avg_cadence  smallint;

-- Index by user_id for "list my runs" queries (already used by listRunActivities).
create index if not exists run_activities_user_id_idx
  on public.run_activities (user_id, started_at desc);
