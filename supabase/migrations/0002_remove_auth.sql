-- Paula — remove authentication.
-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query → Run).
-- Safe to re-run.
--
-- The app no longer has a login screen: it talks to Supabase with only the
-- publishable anon key, no JWT. That means auth.uid() is always null, so
-- RLS policies built on it would block every read/write, and the
-- `default auth.uid()` on user_id columns would fail their not-null check.
-- This migration disables RLS and pins every user_id to one fixed account
-- (must match FIXED_USER_ID in src/lib/supabase/data.ts).
--
-- WARNING: after this runs, anyone with the project URL + anon key (both of
-- which ship in the client bundle) can read and write every row in these
-- tables. That's fine for local/private use only — do not deploy this
-- publicly without re-adding auth and RLS.

do $$
declare
  fixed_user_id uuid := 'a871f9ba-7331-4af8-9914-26323e0edd1f';
  t text;
begin
  foreach t in array array['clients', 'blocked_dates', 'work_log', 'cobros', 'settings', 'day_overrides'] loop
    execute format('alter table public.%I disable row level security', t);
    execute format('drop policy if exists "own rows only" on public.%I', t);
    execute format('alter table public.%I alter column user_id set default %L', t, fixed_user_id);
  end loop;
end $$;
