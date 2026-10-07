-- Paula — Ads module, idea bank, expenses and per-client extras.
-- Run once in the Supabase SQL Editor. Safe to re-run.

alter table public.clients
  add column if not exists ads_ultima_revision date,   -- last "a fondo" Ads review
  add column if not exists ultimo_aumento date,         -- last price increase (next one is due every 3 months)
  add column if not exists notas_reunion text;          -- meeting prep notes

-- Idea bank per client.
create table if not exists public.ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default 'a871f9ba-7331-4af8-9914-26323e0edd1f',
  cliente_id uuid not null references public.clients(id) on delete cascade,
  texto text not null,
  usada boolean not null default false,
  creada_en timestamptz not null default now()
);

-- Daily check of each ads account. id = "{fecha}__{clienteId}".
create table if not exists public.ads_chequeos (
  id text primary key,
  user_id uuid not null default 'a871f9ba-7331-4af8-9914-26323e0edd1f',
  cliente_id uuid not null references public.clients(id) on delete cascade,
  fecha date not null,
  estado text not null check (estado in ('ok', 'revisar')),
  nota text
);

-- Monthly ads report (due days 1-5). id = "{periodo}__{clienteId}".
create table if not exists public.ads_reportes (
  id text primary key,
  user_id uuid not null default 'a871f9ba-7331-4af8-9914-26323e0edd1f',
  cliente_id uuid not null references public.clients(id) on delete cascade,
  periodo text not null, -- "yyyy-MM" the report covers
  estado text not null default 'pendiente' check (estado in ('pendiente', 'enviado'))
);

create table if not exists public.gastos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default 'a871f9ba-7331-4af8-9914-26323e0edd1f',
  fecha date not null,
  concepto text not null,
  monto numeric not null check (monto >= 0)
);

do $$
declare
  t text;
begin
  foreach t in array array['ideas', 'ads_chequeos', 'ads_reportes', 'gastos'] loop
    execute format('alter table public.%I disable row level security', t);
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
