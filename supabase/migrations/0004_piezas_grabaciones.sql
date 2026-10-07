-- Paula — piece-based model.
-- Run once in the Supabase SQL Editor. Safe to re-run.
--
-- Adds the piece (unit of work) and the recording (its own entity) tables, plus
-- the client type / state / "intocable" columns. Follows 0002/0003: no auth, no
-- RLS, every row under the fixed user.

alter table public.clients
  add column if not exists tipo text not null default 'mensual'
    check (tipo in ('mensual', 'pack', 'material-cliente', 'pedidos-diarios', 'ciclo-grabacion')),
  add column if not exists estado text not null default 'al-dia'
    check (estado in ('al-dia', 'en-produccion', 'esperando-aprobacion', 'esperando-pago', 'en-pausa')),
  add column if not exists intocable boolean not null default false;

create table if not exists public.grabaciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default 'a871f9ba-7331-4af8-9914-26323e0edd1f',
  cliente_id uuid not null references public.clients(id) on delete cascade,
  fecha date not null,
  viaje_dias_antes int not null default 0 check (viaje_dias_antes >= 0),
  viaje_dias_despues int not null default 0 check (viaje_dias_despues >= 0),
  hecha boolean not null default false,
  guiones text,
  tomas jsonb not null default '[]'::jsonb,
  alimenta jsonb not null default '[]'::jsonb, -- periods ("2026-10") or pack names this recording feeds
  notas text
);

create table if not exists public.piezas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default 'a871f9ba-7331-4af8-9914-26323e0edd1f',
  cliente_id uuid not null references public.clients(id) on delete cascade,
  tipo text not null check (tipo in ('historia', 'posteo', 'reel')),
  estado text not null default 'idea'
    check (estado in ('idea', 'aprobada', 'grabada', 'editada', 'entregada', 'programada')),
  titulo text,
  grabacion_id uuid references public.grabaciones(id) on delete set null,
  guion_listo boolean not null default false,
  periodo_publicacion text, -- "yyyy-MM"; independent from when it is produced
  fecha_publicacion date,
  fecha_entrega date,
  tanda int not null default 1 check (tanda in (1, 2)),
  horas_reales numeric,
  creada_en timestamptz not null default now()
);

create index if not exists piezas_cliente_idx on public.piezas (cliente_id);
create index if not exists piezas_grabacion_idx on public.piezas (grabacion_id);
create index if not exists grabaciones_cliente_idx on public.grabaciones (cliente_id);

alter table public.grabaciones disable row level security;
alter table public.piezas disable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['grabaciones', 'piezas'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
