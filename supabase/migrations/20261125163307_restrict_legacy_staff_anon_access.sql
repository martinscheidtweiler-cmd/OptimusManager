-- Restrict legacy attendance/availability tables to active Optimus managers.
-- The staff phone app uses only the code-gated staff_phone RPC.
do $$
declare
  table_name text;
  policy record;
  sequence_name regclass;
begin
  foreach table_name in array array[
    'staff_attendance',
    'staff_day_status',
    'staff_members',
    'staff_notifications',
    'staff_weekly_availability'
  ] loop
    if to_regclass(format('public.%I', table_name)) is null then
      continue;
    end if;
    execute format('alter table public.%I enable row level security', table_name);
    for policy in
      select p.policyname from pg_catalog.pg_policies p
       where p.schemaname = 'public' and p.tablename = table_name
    loop
      execute format('drop policy %I on public.%I', policy.policyname, table_name);
    end loop;
    execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using ((select public.optimus_is_manager_admin())) with check ((select public.optimus_is_manager_admin()))',
      table_name || '_manager_admin_all', table_name
    );
    if exists (
      select 1 from pg_catalog.pg_attribute a
      join pg_catalog.pg_class c on c.oid = a.attrelid
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = table_name
        and a.attname = 'id' and not a.attisdropped
    ) then
      sequence_name := pg_get_serial_sequence(format('public.%I', table_name), 'id')::regclass;
    else
      sequence_name := null;
    end if;
    if sequence_name is not null then
      execute format('revoke all on sequence %s from public, anon, authenticated', sequence_name);
      execute format('grant usage, select on sequence %s to authenticated', sequence_name);
    end if;
  end loop;
end;
$$;
