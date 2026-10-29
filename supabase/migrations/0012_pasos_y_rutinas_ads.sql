-- Paula — fourth round: the step each delivery is in, and Ads organised as routines.
-- Run once in the Supabase SQL Editor, after 0010. Safe to re-run.

-- Where each delivery is in its flow (calendario armado → enviado → aprobado →
-- producción → entregado → corrección → ajustes → programado), plus its Canva
-- link and, for clients who send the material, when it has to arrive.
-- id = the cycle id ("{cliente_id}__{yyyy-MM-dd}"). No row = production as usual.
create table if not exists public.entregas_estado (
  id text primary key,
  user_id uuid not null default 'a871f9ba-7331-4af8-9914-26323e0edd1f',
  cliente_id uuid not null references public.clients(id) on delete cascade,
  paso text check (paso in (
    'calendario-armado', 'calendario-enviado', 'calendario-aprobado', 'produccion',
    'entregado', 'correccion', 'ajustes', 'programado'
  )),
  paso_desde date,
  entregado_en date,
  link text,
  material_fecha date,
  material_llego boolean not null default false
);

-- History of each Ads account's routines: the weekly review (ref = ISO week,
-- "2026-W44") and the ads swap every 15 days (ref = the day).
-- id = "{tipo}__{cliente_id}__{ref}".
create table if not exists public.ads_historial (
  id text primary key,
  user_id uuid not null default 'a871f9ba-7331-4af8-9914-26323e0edd1f',
  cliente_id uuid not null references public.clients(id) on delete cascade,
  tipo text not null check (tipo in ('revision', 'recambio')),
  ref text not null,
  fecha date not null
);

-- The monthly report gets the month's analysis, the new structure or strategy,
-- and the day it was sent.
alter table public.ads_reportes
  add column if not exists analisis text,
  add column if not exists estrategia text,
  add column if not exists enviado_en date;

do $$
declare
  t text;
begin
  foreach t in array array['entregas_estado', 'ads_historial'] loop
    execute format('alter table public.%I disable row level security', t);
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
