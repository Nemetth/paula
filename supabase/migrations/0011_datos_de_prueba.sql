-- Paula — test data for the cycle model (0009) and the extras (0010). Data only.
-- Run in the Supabase SQL Editor AFTER 0010. Safe to re-run: it first deletes
-- every "[Demo]" client (and everything hanging off it), then creates the cases
-- again with dates relative to today, so they keep making sense whenever it runs.
--
-- Only rows marked "[Demo]" are touched: real clients are left alone.
--
-- Cases (what to look at in the app):
--   [Demo] Bessone          new monthly client, no cycle yet → the app generates
--                           Historia 1…16, Posteo 1…4, Reel 1…4 on open and spreads
--                           them 1–2 a day over its window. Its cobro (window 1–5)
--                           has no saved row: if today is past the 5th it shows as
--                           vencido the same in Plata, the bell and Hoy.
--   [Demo] Deluxe           intocable, delivery in 2 days with 18 pending: doesn't fit
--                           → overload alert, nothing planned after the delivery,
--                           "correr la entrega" WhatsApp message with a "Mover al …"
--                           button (one tap, with undo). Also red in the morning line.
--   [Demo] Atrasado         delivery 3 days ago with 3 pending → "vencida" alert,
--                           planned as soon as it fits. Last month's cobro unpaid.
--   [Demo] Cierre de ciclo  every piece of the current cycle done → the app opens the
--                           next month's cycle right away; the done one goes to
--                           "Entregas terminadas", Hoy shows "Terminaste una entrega"
--                           with the WhatsApp to send, and its history in the Plata
--                           panel reads "A tiempo: 1 de 1".
--   [Demo] Graba pendiente  records; the recording (in 2 days, 1 travel day after) is
--                           not done → its pieces stay out of the plan, "esperan la
--                           grabación" alert. Mark it done in the file to see them enter.
--   [Demo] Graba hecha      records; recording done 2 days ago → its pieces are planned.
--   [Demo] Graba sin fecha  records; production starts in 3 days and there is no
--                           recording loaded → "no tiene grabación cargada" alert.
--   [Demo] Semanal          weekly client, delivers in 4 days → generates 3 historias +
--                           2 posteos per week, 7 days of lead time by default.
--   [Demo] Calendario       sends an idea calendar → "Calendario de ideas" task in Hoy
--                           before its next window starts.
--   [Demo] Solo Ads         Ads only (red light in Ads): account "frenada por pago", creatives refreshed
--                           35 days ago (alert), Ads Manager link, notes history; this
--                           month's cobro paid.
--   [Demo] Ads + contenido  both services, active account, creatives fresh (green light, no alert).
--   [Demo] Sin día          content client with no delivery day → warning on its card,
--                           nothing generated, not in the plan.
--   [Demo] En pausa         paused → no cycle opens.
--   [Demo] Mandar presupuesto   loose task, due yesterday.
--
-- Not seeded, on purpose: the streak (dias_cumplidos has no client, so it would
-- mix with real days) and push subscriptions. Finish Hoy two working days in a
-- row to see the streak; turn on the morning notification from Ajustes.

-- ---------- 1. delete every dummy ----------

do $$
declare
  demo uuid[] := array(select id from public.clients where nombre like '[Demo]%');
begin
  -- Rows that point at a demo client without a cascading key.
  delete from public.pospuestas
    where split_part(id, ':', 1) in (select id::text from public.piezas where cliente_id = any (demo));
  delete from public.tareas_hechas where cliente_id = any (demo);
  delete from public.tareas where cliente_id = any (demo) or titulo like '[Demo]%';
  delete from public.mensajes_hechos
    where exists (select 1 from unnest(demo) d where public.mensajes_hechos.id like '%' || d::text || '%');
  -- Everything else (ciclos, piezas, grabaciones, cobros, ideas, Ads checks and
  -- reports, blocked days, work log) cascades from the client.
  delete from public.clients where id = any (demo);
end $$;

-- ---------- 2. helpers (this session only) ----------

create or replace function pg_temp.demo_cliente(
  p_id uuid,
  p_nombre text,
  p_servicio text,
  p_volumen jsonb,
  p_flujo jsonb,
  p_extra jsonb default '{}'::jsonb
) returns void language plpgsql as $$
begin
  insert into public.clients (
    id, user_id, nombre, rubro, servicio, volumen_mensual, flujo, contacto_whatsapp, ventana_cobro, monto_mensual,
    activo, notas, tipo, estado, intocable, ads_ultima_revision, ads_cuenta_url, ads_estado_cuenta,
    ads_refresh_creativos, notas_reunion, creado_en
  ) values (
    p_id,
    'a871f9ba-7331-4af8-9914-26323e0edd1f',
    p_nombre,
    p_extra->>'rubro',
    p_servicio,
    p_volumen,
    '{"cicloTipo":"mensual","mandaCalendario":false,"diasAprobacion":2,"tieneGrabacion":false,"diasViajeGrabacion":0,"diasProduccion":8,"diasCorreccion":2,"diasAjustes":1,"diasMargenCierre":3,"margenDias":1}'::jsonb || p_flujo,
    p_extra->>'whatsapp',
    coalesce(p_extra->'ventana', '[1, 10]'::jsonb),
    (p_extra->>'monto')::numeric,
    true,
    p_extra->>'notas',
    'mensual',
    coalesce(p_extra->>'estado', 'en-produccion'),
    coalesce((p_extra->>'intocable')::boolean, false),
    (p_extra->>'revision')::date,
    p_extra->>'ads_url',
    coalesce(p_extra->>'ads_estado', 'activa'),
    (p_extra->>'refresh')::date,
    p_extra->>'reunion',
    now() - interval '90 days'
  );
end $$;

-- A cycle and its pieces, as the app would open it: Historia 1…n, Posteo 1…n,
-- Reel 1…n. The first `*_hechas` of each type are already done.
create or replace function pg_temp.demo_ciclo(
  p_cliente uuid,
  p_entrega date,
  p_historias int,
  p_posteos int,
  p_reels int,
  p_historias_hechas int default 0,
  p_posteos_hechos int default 0,
  p_reels_hechos int default 0
) returns void language plpgsql as $$
declare
  v_ciclo text := p_cliente::text || '__' || p_entrega::text;
begin
  insert into public.ciclos (id, cliente_id, entrega) values (v_ciclo, p_cliente, p_entrega);
  insert into public.piezas (cliente_id, tipo, titulo, hecha, hecha_en, fecha_entrega, ciclo_id, guion_listo, tanda)
  -- Done pieces were done two days before the delivery: on time, for the history.
  select p_cliente, t.tipo, t.nombre || ' ' || i, i <= t.hechas, case when i <= t.hechas then p_entrega - 2 end,
    p_entrega, v_ciclo, false, 1
  from (values ('historia', 'Historia', p_historias, p_historias_hechas),
               ('posteo', 'Posteo', p_posteos, p_posteos_hechos),
               ('reel', 'Reel', p_reels, p_reels_hechos)) as t(tipo, nombre, n, hechas)
  cross join lateral generate_series(1, t.n) as i;
end $$;

-- ---------- 3. the cases ----------

do $$
declare
  bessone   uuid := 'de000000-0000-4000-8000-000000000001';
  deluxe    uuid := 'de000000-0000-4000-8000-000000000002';
  atrasado  uuid := 'de000000-0000-4000-8000-000000000003';
  cierre    uuid := 'de000000-0000-4000-8000-000000000004';
  graba_p   uuid := 'de000000-0000-4000-8000-000000000005';
  graba_h   uuid := 'de000000-0000-4000-8000-000000000006';
  semanal   uuid := 'de000000-0000-4000-8000-000000000007';
  calend    uuid := 'de000000-0000-4000-8000-000000000008';
  solo_ads  uuid := 'de000000-0000-4000-8000-000000000009';
  ambos     uuid := 'de000000-0000-4000-8000-000000000010';
  sin_dia   uuid := 'de000000-0000-4000-8000-000000000011';
  pausa     uuid := 'de000000-0000-4000-8000-000000000012';
  graba_s   uuid := 'de000000-0000-4000-8000-000000000013';
  hoy date := current_date;
  periodo text := to_char(current_date, 'YYYY-MM');
  periodo_ant text := to_char(current_date - interval '1 month', 'YYYY-MM');
  -- Day of the month a delivery N days from today falls on.
  dia_en int;
begin
  -- Bessone: delivers in 20 days, starts 15 before (window already open). No cycle:
  -- the app opens it and generates its 24 pieces.
  dia_en := extract(day from hoy + 20);
  perform pg_temp.demo_cliente(bessone, '[Demo] Bessone', 'contenido',
    '{"historias":16,"posteos":4,"reels":4}',
    jsonb_build_object('diaEntrega', dia_en, 'diasAnticipacion', 15),
    jsonb_build_object('rubro', 'Indumentaria', 'ventana', '[1, 5]'::jsonb, 'monto', 120000,
      'notas', 'Cliente de prueba: piezas generadas por la app.'));
  insert into public.ideas (cliente_id, texto) values
    (bessone, 'Detrás de escena del local'), (bessone, 'Antes y después de una prenda');

  -- Deluxe: intocable, delivers in 2 days, 18 of 20 historias pending.
  dia_en := extract(day from hoy + 2);
  perform pg_temp.demo_cliente(deluxe, '[Demo] Deluxe', 'contenido',
    '{"historias":20,"posteos":0,"reels":0}',
    jsonb_build_object('diaEntrega', dia_en, 'diasAnticipacion', 15),
    jsonb_build_object('intocable', true, 'ventana', '[1, 28]'::jsonb, 'monto', 200000, 'whatsapp', '+54 9 11 0000 0002'));
  perform pg_temp.demo_ciclo(deluxe, hoy + 2, 20, 0, 0, 2);

  -- Atrasado: its delivery was 3 days ago and 3 pieces are still pending.
  dia_en := extract(day from hoy - 3);
  perform pg_temp.demo_cliente(atrasado, '[Demo] Atrasado', 'contenido',
    '{"historias":6,"posteos":2,"reels":0}',
    jsonb_build_object('diaEntrega', dia_en, 'diasAnticipacion', 15),
    jsonb_build_object('monto', 90000, 'reunion', 'Hablar de la entrega atrasada.'));
  perform pg_temp.demo_ciclo(atrasado, hoy - 3, 6, 2, 0, 4, 1);
  insert into public.cobros (id, user_id, cliente_id, periodo, monto, estado, fecha_vencimiento)
  values (atrasado::text || '__' || periodo_ant, 'a871f9ba-7331-4af8-9914-26323e0edd1f', atrasado, periodo_ant, 90000,
    'pendiente', (date_trunc('month', current_date - interval '1 month') + interval '9 days')::date);

  -- Cierre de ciclo: everything of the current delivery is done → the next one opens.
  dia_en := extract(day from hoy + 5);
  perform pg_temp.demo_cliente(cierre, '[Demo] Cierre de ciclo', 'contenido',
    '{"historias":4,"posteos":2,"reels":1}',
    jsonb_build_object('diaEntrega', dia_en, 'diasAnticipacion', 15), '{}');
  perform pg_temp.demo_ciclo(cierre, hoy + 5, 4, 2, 1, 4, 2, 1);

  -- Graba pendiente: recording in 2 days (plus a travel day), not done yet.
  dia_en := extract(day from hoy + 16);
  perform pg_temp.demo_cliente(graba_p, '[Demo] Graba pendiente', 'contenido',
    '{"historias":0,"posteos":4,"reels":4}',
    jsonb_build_object('diaEntrega', dia_en, 'diasAnticipacion', 20, 'tieneGrabacion', true),
    jsonb_build_object('rubro', 'Gastronomía'));
  perform pg_temp.demo_ciclo(graba_p, hoy + 16, 0, 4, 4);
  insert into public.grabaciones (cliente_id, fecha, viaje_dias_antes, viaje_dias_despues, hecha)
  values (graba_p, hoy + 2, 0, 1, false);

  -- Graba hecha: recorded 2 days ago, so its pieces are in the plan.
  dia_en := extract(day from hoy + 14);
  perform pg_temp.demo_cliente(graba_h, '[Demo] Graba hecha', 'contenido',
    '{"historias":6,"posteos":0,"reels":3}',
    jsonb_build_object('diaEntrega', dia_en, 'diasAnticipacion', 15, 'tieneGrabacion', true), '{}');
  perform pg_temp.demo_ciclo(graba_h, hoy + 14, 6, 0, 3);
  insert into public.grabaciones (cliente_id, fecha, viaje_dias_antes, viaje_dias_despues, hecha)
  values (graba_h, hoy - 2, 0, 0, true);

  -- Graba sin fecha: records, production starts in 3 days, no recording loaded.
  -- No cycle either: the app opens it.
  dia_en := extract(day from hoy + 18);
  perform pg_temp.demo_cliente(graba_s, '[Demo] Graba sin fecha', 'contenido',
    '{"historias":4,"posteos":2,"reels":2}',
    jsonb_build_object('diaEntrega', dia_en, 'diasAnticipacion', 15, 'tieneGrabacion', true), '{}');

  -- Semanal: delivers every week on the weekday 4 days from now. No cycle: generated.
  perform pg_temp.demo_cliente(semanal, '[Demo] Semanal', 'contenido',
    '{"historias":3,"posteos":2,"reels":0}',
    jsonb_build_object('cicloTipo', 'semanal', 'diaEntrega', extract(dow from hoy + 4)::int), '{}');

  -- Calendario: sends an idea calendar; its next window starts in 7 days.
  dia_en := extract(day from hoy + 22);
  perform pg_temp.demo_cliente(calend, '[Demo] Calendario', 'contenido',
    '{"historias":8,"posteos":2,"reels":2}',
    jsonb_build_object('diaEntrega', dia_en, 'diasAnticipacion', 15, 'mandaCalendario', true), '{}');

  -- Solo Ads: account stopped over a payment, creatives 35 days old, notes history.
  perform pg_temp.demo_cliente(solo_ads, '[Demo] Solo Ads', 'ads', '{"historias":0,"posteos":0,"reels":0}', '{}',
    jsonb_build_object('ads_estado', 'frenada-pago', 'refresh', hoy - 35, 'revision', hoy - 20,
      'ads_url', 'https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=000000000', 'monto', 60000));
  insert into public.ads_chequeos (id, cliente_id, fecha, estado, nota) values
    ((hoy - 1)::text || '__' || solo_ads, solo_ads, hoy - 1, 'revisar', 'Rechazaron la tarjeta: la cuenta quedó frenada.'),
    ((hoy - 2)::text || '__' || solo_ads, solo_ads, hoy - 2, 'ok', 'CPM estable, sin cambios.'),
    ((hoy - 4)::text || '__' || solo_ads, solo_ads, hoy - 4, 'ok', 'Subí presupuesto a la campaña de mensajes.');
  insert into public.cobros (id, user_id, cliente_id, periodo, monto, estado, fecha_vencimiento, fecha_pago)
  values (solo_ads::text || '__' || periodo, 'a871f9ba-7331-4af8-9914-26323e0edd1f', solo_ads, periodo, 60000,
    'pagado', (date_trunc('month', current_date) + interval '9 days')::date, hoy);

  -- Ads + contenido: both services, active account, fresh creatives.
  dia_en := extract(day from hoy + 25);
  perform pg_temp.demo_cliente(ambos, '[Demo] Ads + contenido', 'ambos',
    '{"historias":8,"posteos":4,"reels":2}',
    jsonb_build_object('diaEntrega', dia_en, 'diasAnticipacion', 15),
    jsonb_build_object('refresh', hoy - 10, 'revision', hoy - 3,
      'ads_url', 'https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=111111111'));
  insert into public.ads_chequeos (id, cliente_id, fecha, estado, nota) values
    ((hoy - 1)::text || '__' || ambos, ambos, hoy - 1, 'ok', 'Todo en orden.');

  -- Sin día: content client without a delivery day.
  perform pg_temp.demo_cliente(sin_dia, '[Demo] Sin día', 'contenido', '{"historias":5,"posteos":2,"reels":1}', '{}', '{}');

  -- En pausa: has everything to plan, but it's paused.
  dia_en := extract(day from hoy + 10);
  perform pg_temp.demo_cliente(pausa, '[Demo] En pausa', 'contenido', '{"historias":4,"posteos":2,"reels":0}',
    jsonb_build_object('diaEntrega', dia_en), jsonb_build_object('estado', 'en-pausa'));

  -- Loose task already due.
  insert into public.tareas (titulo, horas, fecha_limite, cliente_id)
  values ('[Demo] Mandar presupuesto', 1, hoy - 1, deluxe);
end $$;
