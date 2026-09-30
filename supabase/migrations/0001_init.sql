-- Paula — initial schema.
-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query → Run).
-- Safe to re-run: every statement is idempotent (IF NOT EXISTS / OR REPLACE).

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre text not null,
  rubro text,
  servicio text not null check (servicio in ('contenido', 'ads', 'ambos')),
  volumen_mensual jsonb not null default '{"historias":0,"posteos":0,"reels":0}'::jsonb,
  flujo jsonb not null,
  contacto_whatsapp text,
  ventana_cobro jsonb, -- [diaInicio, diaFin] or null
  monto_mensual numeric,
  activo boolean not null default true,
  notas text,
  creado_en timestamptz not null default now()
);

create table if not exists public.blocked_dates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cliente_id uuid not null references public.clients(id) on delete cascade,
  fecha date not null,
  motivo text not null check (motivo in ('grabacion', 'viaje', 'no-trabaje', 'otro')),
  detalle text
);

create table if not exists public.work_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cliente_id uuid not null references public.clients(id) on delete cascade,
  etapa text not null,
  pieza_tipo text,
  cantidad numeric not null,
  fecha date not null,
  horas numeric
);

create table if not exists public.cobros (
  id text primary key, -- deterministic "{clienteId}__{periodo}", set by the app
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cliente_id uuid not null references public.clients(id) on delete cascade,
  periodo text not null,
  monto numeric,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'pagado', 'vencido')),
  fecha_vencimiento date not null,
  fecha_pago date,
  unique (cliente_id, periodo)
);

create table if not exists public.settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  estructura_semanal jsonb not null
);

create table if not exists public.day_overrides (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  fecha date not null,
  horas_disponibles numeric not null,
  primary key (user_id, fecha)
);

-- Row Level Security: every table is private to the row's own user_id. Paula
-- is the only user this app expects, but this is what makes the publishable
-- key safe to ship in client code — without it, anyone with the URL+key could
-- read or write every row.
alter table public.clients enable row level security;
alter table public.blocked_dates enable row level security;
alter table public.work_log enable row level security;
alter table public.cobros enable row level security;
alter table public.settings enable row level security;
alter table public.day_overrides enable row level security;

drop policy if exists "own rows only" on public.clients;
create policy "own rows only" on public.clients for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own rows only" on public.blocked_dates;
create policy "own rows only" on public.blocked_dates for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own rows only" on public.work_log;
create policy "own rows only" on public.work_log for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own rows only" on public.cobros;
create policy "own rows only" on public.cobros for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own rows only" on public.settings;
create policy "own rows only" on public.settings for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own rows only" on public.day_overrides;
create policy "own rows only" on public.day_overrides for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Realtime: lets the app push changes to every open tab/device instantly.
-- ALTER PUBLICATION ... ADD TABLE has no IF NOT EXISTS clause, so guard each
-- one manually to keep this migration safe to re-run.
do $$
declare
  t text;
begin
  foreach t in array array['clients', 'blocked_dates', 'work_log', 'cobros', 'day_overrides'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
