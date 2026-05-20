-- Add a unique, lowercase @username column to profiles.
-- Run this in Supabase Dashboard → SQL Editor → New query, then "Run".
--
-- Constraints:
--   - 3-20 characters
--   - lowercase letters / numbers / underscores only
--   - unique across all users (case-insensitive via lower() index)
--
-- The column is nullable to allow gradual backfill — every user will get
-- one auto-generated from their email prefix on next login (see
-- ensureProfileComplete in src/lib/community.js).

alter table public.profiles
  add column if not exists username text;

-- Force lowercase only — Postgres CHECK constraint guarantees this server-side
-- regardless of what the client sends.
alter table public.profiles
  drop constraint if exists profiles_username_format_check;
alter table public.profiles
  add constraint profiles_username_format_check
  check (username is null or username ~ '^[a-z0-9_]{3,20}$');

-- Unique constraint. Plain unique index since the format check already forces
-- lowercase — no need for a separate lower() expression index.
create unique index if not exists profiles_username_unique_idx
  on public.profiles (username)
  where username is not null;

-- Allow users to update their own username via the existing profile RLS policy
-- (UPDATE policy already exists from the earlier profile setup — this column
-- inherits it). No new policy needed.
