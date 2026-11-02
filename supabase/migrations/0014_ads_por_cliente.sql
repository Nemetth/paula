-- Paula — fifth round: Ads as "what to do and what's missing" per client.
-- Run once in the Supabase SQL Editor, after 0013. Safe to re-run.

-- The account's current strategy, in one line.
alter table public.clients
  add column if not exists ads_estrategia text;

-- Short list of ideas to try on an account. Separate from `ideas`, the content idea bank.
create table if not exists public.ads_ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default 'a871f9ba-7331-4af8-9914-26323e0edd1f',
  cliente_id uuid not null references public.clients(id) on delete cascade,
  texto text not null,
  probada boolean not null default false,
  creada_en timestamptz not null default now()
);

-- "Falta: fotos nuevas": what Paula notes she's missing for an account.
create table if not exists public.ads_faltan (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default 'a871f9ba-7331-4af8-9914-26323e0edd1f',
  cliente_id uuid not null references public.clients(id) on delete cascade,
  texto text not null,
  fecha date,
  hecha boolean not null default false,
  creada_en timestamptz not null default now()
);

-- Campaigns for a special date (Black Friday, Navidad...). id = the date, "yyyy-MM-dd".
-- No row = it applies to every account and isn't done; `clientes` null means the same.
create table if not exists public.ads_fechas (
  id text primary key,
  user_id uuid not null default 'a871f9ba-7331-4af8-9914-26323e0edd1f',
  clientes text[],
  hecha boolean not null default false
);

do $$
declare
  t text;
begin
  foreach t in array array['ads_ideas', 'ads_faltan', 'ads_fechas'] loop
    execute format('alter table public.%I disable row level security', t);
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
