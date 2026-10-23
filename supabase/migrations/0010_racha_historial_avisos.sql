-- Paula — streak of days done, when each piece was finished, and the morning push.
-- Run once in the Supabase SQL Editor, after 0009 (0011 is test data, optional).
-- Safe to re-run.

-- When a piece was ticked done: the client history reads on-time deliveries
-- from it. Pieces already done keep it empty (nobody knows when they were done).
alter table public.piezas add column if not exists hecha_en date;

-- One row per day Paula finished everything Hoy had for her. The streak in Hoy
-- counts consecutive working days in this table. id = the date.
create table if not exists public.dias_cumplidos (
  id date primary key,
  user_id uuid not null default 'a871f9ba-7331-4af8-9914-26323e0edd1f'
);

-- Devices that asked for the morning notification. id = the push endpoint.
create table if not exists public.push_suscripciones (
  id text primary key,
  user_id uuid not null default 'a871f9ba-7331-4af8-9914-26323e0edd1f',
  suscripcion jsonb not null,
  creada_en timestamptz not null default now()
);

do $$
declare
  t text;
begin
  foreach t in array array['dias_cumplidos', 'push_suscripciones'] loop
    execute format('alter table public.%I disable row level security', t);
  end loop;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'dias_cumplidos'
  ) then
    alter publication supabase_realtime add table public.dias_cumplidos;
  end if;
end $$;
