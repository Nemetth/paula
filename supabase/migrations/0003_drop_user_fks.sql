-- Paula — drop foreign keys to auth.users.
-- Run once in the Supabase SQL Editor. Safe to re-run.
--
-- With auth removed (see 0002), every row is saved under a fixed user_id that
-- has no row in auth.users, so the user_id foreign keys reject every insert.

do $$
declare
  r record;
begin
  for r in
    select conrelid::regclass as tbl, conname
    from pg_constraint
    where contype = 'f'
      and confrelid = 'auth.users'::regclass
      and connamespace = 'public'::regnamespace
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;
end $$;
