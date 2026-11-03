-- Paula — each Ads account can have its own report day ("a WC se lo entrego el 11").
-- Run once in the Supabase SQL Editor, after 0014. Safe to re-run.

-- Day of the month the report is due. Null = with the rest, days 1 to 5.
alter table public.clients
  add column if not exists ads_dia_reporte smallint check (ads_dia_reporte between 1 and 31);
