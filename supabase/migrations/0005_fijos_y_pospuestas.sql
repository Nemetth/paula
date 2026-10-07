-- Paula — daily-fixed ticks and postponed pieces.
-- Run once in the Supabase SQL Editor. Safe to re-run.

-- One row per (day, fixed routine) that was ticked off. id = "{fecha}__{fijoId}".
create table if not exists public.fijos_hechos (
  id text primary key,
  user_id uuid not null default 'a871f9ba-7331-4af8-9914-26323e0edd1f',
  fecha date not null,
  fijo_id text not null
);
alter table public.fijos_hechos disable row level security;

-- "No llegué a X": the piece can't be worked before this date. Nothing else is
-- stored; the planner re-derives the rest.
alter table public.piezas add column if not exists no_antes_de date;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'fijos_hechos'
  ) then
    alter publication supabase_realtime add table public.fijos_hechos;
  end if;
end $$;
