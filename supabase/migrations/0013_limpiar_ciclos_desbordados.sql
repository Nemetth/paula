-- Paula — clean up the cycles a bug opened years ahead.
-- Run once in the Supabase SQL Editor, AFTER deploying the fix (an older
-- version of the app left open would keep opening them). Safe to re-run.
--
-- What happened: opening a cycle writes its row, then its pieces. The row came
-- back through realtime before the pieces, so the new cycle looked empty, an
-- empty cycle read as "all done", and the next one opened — in a chain, up to
-- 2076. Past 1000 pieces the app also stopped seeing the newest ones, which
-- kept the chain going on every load.
--
-- This deletes every cycle whose production window hasn't started yet (today
-- in Argentina < delivery − días de anticipación) and that nobody touched: no
-- piece done, scripted, tied to a recording, timed or postponed, and no step,
-- link or material saved for the delivery. The app opens each one again by
-- itself when its window starts.

begin;

create temporary table ciclos_de_mas on commit drop as
select ci.id
from public.ciclos ci
join public.clients c on c.id = ci.cliente_id
where ci.entrega - greatest(
        coalesce(
          (c.flujo->>'diasAnticipacion')::int,
          case c.flujo->>'cicloTipo' when 'semanal' then 7 when 'quincenal' then 10 else 15 end
        ),
        0
      ) > (now() at time zone 'America/Argentina/Buenos_Aires')::date
  and not exists (
    select 1 from public.piezas p
    where p.ciclo_id = ci.id
      and (p.hecha or p.hecha_en is not null or p.guion_listo or p.grabacion_id is not null
           or p.horas_reales is not null or p.no_antes_de is not null)
  )
  and not exists (select 1 from public.entregas_estado e where e.id = ci.id);

create temporary table borrado on commit drop as
select
  (select count(*) from ciclos_de_mas) as ciclos_borrados,
  (select count(*) from public.piezas where ciclo_id in (select id from ciclos_de_mas)) as piezas_borradas;

delete from public.pospuestas
where split_part(id, ':', 1) in (
  select p.id::text from public.piezas p where p.ciclo_id in (select id from ciclos_de_mas)
);
delete from public.piezas where ciclo_id in (select id from ciclos_de_mas);
delete from public.ciclos where id in (select id from ciclos_de_mas);

-- What went (the editor shows this last result).
select * from borrado;

commit;
