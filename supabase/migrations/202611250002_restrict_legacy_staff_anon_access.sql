-- The legacy staff tables were exposed to anon by permissive policies. Keep the
-- existing logged-in manager behavior, but remove the public/anonymous path.
do $$
declare
  table_name text;
  policy_name text;
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
    execute format('revoke all on table public.%I from anon', table_name);
    for policy_name in
      select p.policyname from pg_policies p
       where p.schemaname = 'public'
         and p.tablename = table_name
         and 'anon' = any (p.roles::text[])
    loop
      execute format('drop policy %I on public.%I', policy_name, table_name);
    end loop;
    execute format('drop policy if exists staff_legacy_authenticated_access on public.%I', table_name);
    execute format(
      'create policy staff_legacy_authenticated_access on public.%I for all to authenticated using (true) with check (true)',
      table_name
    );
    sequence_name := pg_get_serial_sequence(format('public.%I', table_name), 'id')::regclass;
    if sequence_name is not null then
      execute format('revoke all on sequence %s from anon', sequence_name);
    end if;
  end loop;
end;
$$;
