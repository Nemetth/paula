-- Paula — delivery cycles, pieces as a done/not-done tick, and Ads account data.
-- Run once in the Supabase SQL Editor. Safe to re-run.
--
-- - A client delivers weekly or monthly on a fixed day (flujo.cicloTipo +
--   flujo.diaEntrega) and starts producing flujo.diasAnticipacion days before.
--   Each delivery is a cycle (table `ciclos`) whose pieces the app generates
--   from the client's volume.
-- - A piece is no longer idea / aprobada / grabada / editada / entregada /
--   programada: it is done or not (`hecha`).
-- - The delivery date never comes from a recording again: pieces that had
--   none get the date they were showing (recording + 7 days) written down.

-- ---------- pieces: estado → hecha ----------

alter table public.piezas
  add column if not exists hecha boolean not null default false,
  add column if not exists ciclo_id text;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'piezas' and column_name = 'estado'
  ) then
    update public.piezas set hecha = estado in ('editada', 'entregada', 'programada');
    update public.piezas p
      set fecha_entrega = g.fecha + 7
      from public.grabaciones g
      where p.fecha_entrega is null and p.grabacion_id = g.id;
    alter table public.piezas drop column estado;
  end if;
end $$;

-- ---------- clients: cycle settings (inside flujo) ----------

-- "Graba" is one flag now. It used to be read from inicioDesde when present.
update public.clients
set flujo = flujo || jsonb_build_object(
  'tieneGrabacion',
  case
    when flujo ? 'inicioDesde' then flujo->>'inicioDesde' = 'grabacion'
    else coalesce((flujo->>'tieneGrabacion')::boolean, false)
      and tipo not in ('material-cliente', 'pedidos-diarios', 'pack')
  end,
  'cicloTipo',
  case when flujo->>'cicloTipo' = 'semanal' then 'semanal' else 'mensual' end
);

-- Delivery day, read off the latest delivery each client already has.
update public.clients c
set flujo = c.flujo || jsonb_build_object(
  'diaEntrega',
  case when c.flujo->>'cicloTipo' = 'semanal' then extract(dow from x.f)::int else extract(day from x.f)::int end
)
from (
  select cliente_id, max(fecha_entrega) as f
  from public.piezas
  where fecha_entrega is not null
  group by cliente_id
) x
where x.cliente_id = c.id and not (c.flujo ? 'diaEntrega');

-- ---------- cycles ----------

-- One row per delivery the app opened for a client. id = "{clienteId}__{entrega}",
-- so two devices opening the same cycle at once write the same row once.
create table if not exists public.ciclos (
  id text primary key,
  user_id uuid not null default 'a871f9ba-7331-4af8-9914-26323e0edd1f',
  cliente_id uuid not null references public.clients(id) on delete cascade,
  entrega date not null, -- the delivery as the cycle settings computed it
  creado_en timestamptz not null default now()
);

create index if not exists ciclos_cliente_idx on public.ciclos (cliente_id);

-- The deliveries that already exist become cycles, so the app doesn't generate them again.
insert into public.ciclos (id, cliente_id, entrega)
select distinct cliente_id::text || '__' || fecha_entrega::text, cliente_id, fecha_entrega
from public.piezas
where fecha_entrega is not null
on conflict (id) do nothing;

update public.piezas
set ciclo_id = cliente_id::text || '__' || fecha_entrega::text
where ciclo_id is null and fecha_entrega is not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'piezas_ciclo_id_fkey') then
    alter table public.piezas
      add constraint piezas_ciclo_id_fkey foreign key (ciclo_id) references public.ciclos(id) on delete set null;
  end if;
end $$;

create index if not exists piezas_ciclo_idx on public.piezas (ciclo_id);

-- ---------- Ads account data ----------

alter table public.clients
  add column if not exists ads_cuenta_url text,          -- direct link to the Ads Manager account
  add column if not exists ads_estado_cuenta text not null default 'activa'
    check (ads_estado_cuenta in ('activa', 'pausada', 'frenada-pago')),
  add column if not exists ads_refresh_creativos date;   -- last creative refresh (alert after 28 days)

-- ---------- realtime / RLS ----------

alter table public.ciclos disable row level security;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ciclos'
  ) then
    alter publication supabase_realtime add table public.ciclos;
  end if;
end $$;
