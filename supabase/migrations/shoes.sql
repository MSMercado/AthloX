-- v2.0 — shoes table for tracking which footwear was used on each run.
--
-- Mileage is NOT stored here — it's a live SUM(distance_km) over
-- run_activities WHERE shoes_id = X (one extra query when rendering the
-- shoes list). Keeps the row truthful even if a user deletes runs.
--
-- Run once in Supabase SQL Editor before shipping v2.0.

create table if not exists public.shoes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  brand       text,
  model       text,
  -- Optional starting mileage if the user is migrating from another app.
  start_km    real not null default 0,
  -- Retired shoes still show on past runs but are hidden from the picker.
  retired     boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table public.shoes enable row level security;

drop policy if exists "Users can read own shoes"   on public.shoes;
drop policy if exists "Users can write own shoes"  on public.shoes;
drop policy if exists "Users can update own shoes" on public.shoes;
drop policy if exists "Users can delete own shoes" on public.shoes;

create policy "Users can read own shoes"
  on public.shoes for select
  using (auth.uid() = user_id);

create policy "Users can write own shoes"
  on public.shoes for insert
  with check (auth.uid() = user_id);

create policy "Users can update own shoes"
  on public.shoes for update
  using (auth.uid() = user_id);

create policy "Users can delete own shoes"
  on public.shoes for delete
  using (auth.uid() = user_id);

create index if not exists shoes_user_id_idx on public.shoes (user_id, retired);

-- shoes_id column on run_activities was added by run_activities_v2_columns.sql.
-- Adding the FK now that the shoes table exists.
alter table public.run_activities
  drop constraint if exists run_activities_shoes_fk;
alter table public.run_activities
  add constraint run_activities_shoes_fk
  foreign key (shoes_id) references public.shoes(id) on delete set null;

create index if not exists run_activities_shoes_id_idx
  on public.run_activities (shoes_id);
