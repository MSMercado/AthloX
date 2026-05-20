-- v1.2.1 hotfix — backfill profiles.username for every user that still has NULL.
--
-- Why: ensureProfileComplete (src/lib/community.js) is supposed to auto-fill
-- a username on login, but some users were created before v1.2.0 shipped or
-- the client-side backfill didn't run, leaving username NULL. That breaks:
--   1. ProfileScreen falls back to '@<email-prefix>' which testers misread
--      as "the app is showing my email"
--   2. Username search (@handle) returns no results because there's nothing
--      stored to match against
--
-- Run this once in Supabase SQL Editor.

-- Derive a sanitised stem from the email local-part: lowercase, strip
-- everything except a-z0-9_, clamp to 3-20 chars. If the stem collides with
-- another row, suffix with a short random number until it's unique.
do $$
declare
  r record;
  stem text;
  candidate text;
  suffix int;
  attempts int;
begin
  for r in
    select p.id, u.email
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.username is null
      and u.email is not null
  loop
    stem := lower(split_part(r.email, '@', 1));
    stem := regexp_replace(stem, '[^a-z0-9_]', '', 'g');

    if length(stem) < 3 then
      stem := 'athlete' || substr(replace(r.id::text, '-', ''), 1, 6);
    end if;

    if length(stem) > 20 then
      stem := substr(stem, 1, 20);
    end if;

    candidate := stem;
    attempts := 0;

    -- Try the bare stem first, then stem + 3-4 digit suffix up to 6 times.
    while exists (select 1 from public.profiles where username = candidate) and attempts < 6 loop
      suffix := floor(random() * 9000 + 100)::int;
      candidate := substr(stem, 1, 20 - length(suffix::text)) || suffix::text;
      attempts := attempts + 1;
    end loop;

    if not exists (select 1 from public.profiles where username = candidate) then
      update public.profiles set username = candidate where id = r.id;
    end if;
  end loop;
end $$;

-- Sanity check: how many NULL usernames remain (should be 0 for users with an email).
-- select count(*) from public.profiles where username is null;
