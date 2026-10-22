-- Paula — what got done each day, and work moved to a later day.
-- Run once in the Supabase SQL Editor. Safe to re-run.

-- One row per unit of work ticked off on a day. Hoy keeps showing it (struck
-- through) and counts it in "3 de 8 hechas", even though the plan no longer
-- contains it. id = "{fecha}__{unidadId}".
create table if not exists public.tareas_hechas (
  id text primary key,
  user_id uuid not null default 'a871f9ba-7331-4af8-9914-26323e0edd1f',
  fecha date not null,
  unidad_id text not null,
  etiqueta text not null,
  cliente_id uuid references public.clients(id) on delete set null,
  tipo text not null default 'edicion',
  /** What undoing it needs: the value the source fact had before the tick. */
  anterior text
);

-- "Pasar a mañana" / "Cerrar el día": the unit can't be worked before `hasta`.
-- id = unit id, so moving it again just overwrites the date.
create table if not exists public.pospuestas (
  id text primary key,
  user_id uuid not null default 'a871f9ba-7331-4af8-9914-26323e0edd1f',
  hasta date not null
);

do $$
declare
  t text;
begin
  foreach t in array array['tareas_hechas', 'pospuestas'] loop
    execute format('alter table public.%I disable row level security', t);
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
