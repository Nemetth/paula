-- Paula — loose tasks and sent-message tracking.
-- Run once in the Supabase SQL Editor. Safe to re-run.

-- Loose tasks added with the "+" button. They enter the planner like any other work.
create table if not exists public.tareas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default 'a871f9ba-7331-4af8-9914-26323e0edd1f',
  titulo text not null,
  horas numeric not null default 0.5 check (horas > 0),
  fecha_limite date,
  cliente_id uuid references public.clients(id) on delete set null,
  hecha boolean not null default false,
  creada_en timestamptz not null default now()
);

-- WhatsApp messages that already went out, so they stop showing up in Hoy.
-- id = "{tipo}__{clienteId}__{referencia}", where the reference changes when the
-- message is due again (e.g. a new week for an approval reminder).
create table if not exists public.mensajes_hechos (
  id text primary key,
  user_id uuid not null default 'a871f9ba-7331-4af8-9914-26323e0edd1f',
  fecha date not null
);

do $$
declare
  t text;
begin
  foreach t in array array['tareas', 'mensajes_hechos'] loop
    execute format('alter table public.%I disable row level security', t);
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
