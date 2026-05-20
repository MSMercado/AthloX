-- UGC safety tables — required by Google Play before promoting past Internal
-- Testing. Adds the data backing for "Report this post" and "Block user".
--
-- Run this in Supabase Dashboard → SQL Editor → New query, then "Run".

-- ── post_reports ──────────────────────────────────────────────────────────────
create table if not exists public.post_reports (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references public.posts(id) on delete cascade,
  reporter_id  uuid not null references auth.users(id) on delete cascade,
  reason       text not null,            -- 'spam' | 'harassment' | 'inappropriate' | 'other'
  details      text,                     -- optional free-form context
  created_at   timestamptz not null default now(),
  -- One report per user per post (re-reporting is a no-op)
  unique (post_id, reporter_id)
);

create index if not exists post_reports_post_idx
  on public.post_reports (post_id);

alter table public.post_reports enable row level security;

drop policy if exists "Users can read own reports" on public.post_reports;
drop policy if exists "Users can create reports"   on public.post_reports;
create policy "Users can read own reports"
  on public.post_reports for select using (auth.uid() = reporter_id);
create policy "Users can create reports"
  on public.post_reports for insert with check (auth.uid() = reporter_id);

-- ── blocked_users ─────────────────────────────────────────────────────────────
create table if not exists public.blocked_users (
  id           uuid primary key default gen_random_uuid(),
  blocker_id   uuid not null references auth.users(id) on delete cascade,
  blocked_id   uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (blocker_id, blocked_id),
  check (blocker_id != blocked_id)
);

create index if not exists blocked_users_blocker_idx
  on public.blocked_users (blocker_id);

alter table public.blocked_users enable row level security;

drop policy if exists "Users can read own blocks"   on public.blocked_users;
drop policy if exists "Users can create blocks"    on public.blocked_users;
drop policy if exists "Users can delete own blocks" on public.blocked_users;
create policy "Users can read own blocks"
  on public.blocked_users for select using (auth.uid() = blocker_id);
create policy "Users can create blocks"
  on public.blocked_users for insert with check (auth.uid() = blocker_id);
create policy "Users can delete own blocks"
  on public.blocked_users for delete using (auth.uid() = blocker_id);
