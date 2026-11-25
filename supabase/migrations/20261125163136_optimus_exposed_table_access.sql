-- Protect exposed horse, medical, and legacy location data with RLS and grants.
-- Stable staff may read horse and location data; only active managers can
-- write it. Medical records and legacy placement administration are admin-only.

create or replace function public.optimus_is_stable_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.optimus_task_people p
     where p.user_id = (select auth.uid())
       and p.active is true
       and p.role in ('admin', 'member', 'planner')
  );
$$;
revoke all on function public.optimus_is_stable_staff() from public, anon, authenticated;
grant execute on function public.optimus_is_stable_staff() to authenticated;

-- Close the unauthenticated write RPC before changing table policies.
create or replace function public.move_horse_v2(
  p_horse_id uuid,
  p_site_id uuid,
  p_area_id uuid default null,
  p_unit_id uuid default null,
  p_moved_by text default null,
  p_move_note text default null,
  p_assigned_at timestamptz default now()
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
  blocked boolean;
  destination_site uuid;
  destination_area uuid;
begin
  if not public.optimus_is_stable_staff() then
    raise exception 'Active staff login required';
  end if;
  if p_unit_id is null then
    raise exception 'Choose a destination weide/stal before moving a horse';
  end if;
  select site_id, area_id into strict destination_site, destination_area
    from public.place_units where id = p_unit_id and active is true;
  if p_site_id is distinct from destination_site
     or (p_area_id is not null and p_area_id is distinct from destination_area) then
    raise exception 'Destination site/area mismatch';
  end if;
  select public.is_place_blocked(destination_site, destination_area, p_unit_id, p_assigned_at)
    into blocked;
  if blocked then raise exception 'Destination is currently blocked'; end if;
  update public.horse_place_assignments
     set left_at = p_assigned_at
   where horse_id = p_horse_id and left_at is null;
  insert into public.horse_place_assignments(
    horse_id, site_id, area_id, unit_id, assigned_at, moved_by, move_note
  ) values (
    p_horse_id, destination_site, destination_area, p_unit_id, p_assigned_at, p_moved_by, p_move_note
  ) returning id into new_id;
  return new_id;
end;
$$;
revoke all on function public.move_horse_v2(uuid, uuid, uuid, uuid, text, text, timestamptz) from public, anon;
grant execute on function public.move_horse_v2(uuid, uuid, uuid, uuid, text, text, timestamptz) to authenticated;
revoke all on function public.bulk_move_horses_v2(uuid[], uuid, uuid, uuid, text, text, timestamptz) from public, anon;
grant execute on function public.bulk_move_horses_v2(uuid[], uuid, uuid, uuid, text, text, timestamptz) to authenticated;

do $$
declare
  table_name text;
  policy record;
  sequence_name regclass;
  stable_read_tables text[] := array[
    'horses', 'horse_place_assignments', 'sites', 'place_areas', 'place_units'
  ];
  admin_only_tables text[] := array[
    'place_blocks', 'place_groups', 'place_group_units',
    'farrier_visits', 'medicines', 'medicine_issuances', 'medicine_usage',
    'vaccination_records', 'vaccination_passport_status', 'deworming_records',
    'horse_xray_records', 'horse_lab_results', 'riding_sessions'
  ];
begin
  foreach table_name in array stable_read_tables || admin_only_tables loop
    if to_regclass(format('public.%I', table_name)) is null then
      continue;
    end if;
    execute format('alter table public.%I enable row level security', table_name);
    for policy in
      select p.policyname
        from pg_catalog.pg_policies p
       where p.schemaname = 'public' and p.tablename = table_name
    loop
      execute format('drop policy %I on public.%I', policy.policyname, table_name);
    end loop;
    execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', table_name);
    if table_name = any(stable_read_tables) then
      execute format(
        'create policy %I on public.%I for select to authenticated using ((select public.optimus_is_stable_staff()))',
        table_name || '_stable_staff_read', table_name
      );
    end if;
    if table_name = any(admin_only_tables) or table_name = 'horses'
       or table_name in ('horse_place_assignments', 'sites', 'place_areas', 'place_units') then
      execute format(
        'create policy %I on public.%I for all to authenticated using ((select public.optimus_is_manager_admin())) with check ((select public.optimus_is_manager_admin()))',
        table_name || '_manager_admin_all', table_name
      );
    end if;
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

-- These views were created as SECURITY DEFINER by default. Make their results
-- obey the policies above and remove their anonymous Data API grants.
alter view public.horse_current_places_v2 set (security_invoker = true);
alter view public.place_current_blocks_v2 set (security_invoker = true);
alter view public.medicine_register_view set (security_invoker = true);
alter view public.medicine_batch_stock_view set (security_invoker = true);
alter view public.medicine_stock_view set (security_invoker = true);
alter view public.medicine_expiry_warning_view set (security_invoker = true);
revoke all on public.horse_current_places_v2, public.place_current_blocks_v2,
  public.medicine_register_view, public.medicine_batch_stock_view,
  public.medicine_stock_view, public.medicine_expiry_warning_view
  from public, anon, authenticated;
grant select on public.horse_current_places_v2, public.place_current_blocks_v2,
  public.medicine_register_view, public.medicine_batch_stock_view,
  public.medicine_stock_view, public.medicine_expiry_warning_view to authenticated;

notify pgrst, 'reload schema';
