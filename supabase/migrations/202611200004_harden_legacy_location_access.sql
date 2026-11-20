-- STAGING FIRST. This deliberately tightens legacy table permissions that are
-- currently permissive (including publicly writable location groups/blocks).
-- Validate all existing clients before applying to the shared production DB.
-- Requires migration 202611200003.

create or replace function public.optimus_is_stable_staff()
returns boolean language sql stable security definer
set search_path=''
as $$
 select exists(
  select 1 from public.optimus_task_people p
  where p.user_id=(select auth.uid())
    and p.active is true
    and p.role in ('admin','member','planner')
 );
$$;
revoke all on function public.optimus_is_stable_staff() from public, anon, authenticated;
grant execute on function public.optimus_is_stable_staff() to authenticated;

do $$
declare t text; pol record;
begin
 foreach t in array array[
  'horses','horse_place_assignments','sites','place_units',
  'place_areas','place_blocks','place_groups','place_group_units'
 ] loop
   execute format('alter table public.%I enable row level security',t);
   -- Remove previously permissive ALL/INSERT/UPDATE/DELETE policies.
   for pol in
     select policyname from pg_catalog.pg_policies
      where schemaname='public' and tablename=t
   loop
     execute format('drop policy if exists %I on public.%I',pol.policyname,t);
   end loop;

   -- Preserve existing anonymous read-only display behavior, so current
   -- public location maps continue working. Never allow anonymous writes.
   execute format('create policy %I on public.%I for select to anon using (true)',
     t||'_public_read',t);
   execute format(
     'create policy %I on public.%I for select to authenticated using ((select public.optimus_is_stable_staff()))',
      t||'_staff_read',t);
   execute format(
     'create policy %I on public.%I for insert to authenticated with check ((select public.optimus_is_manager_admin()))',
      t||'_admin_insert',t);
   execute format(
     'create policy %I on public.%I for update to authenticated using ((select public.optimus_is_manager_admin())) with check ((select public.optimus_is_manager_admin()))',
      t||'_admin_update',t);
   execute format(
     'create policy %I on public.%I for delete to authenticated using ((select public.optimus_is_manager_admin()))',
      t||'_admin_delete',t);

   execute format('revoke all on public.%I from anon, authenticated',t);
   execute format('grant select on public.%I to anon, authenticated',t);
   execute format('grant insert,update,delete on public.%I to authenticated',t);
 end loop;
end $$;

-- Migrate the legacy publicly callable SECURITY DEFINER function into a
-- deliberately unprivileged adapter. All writes run through the audited,
-- idempotent function and create HorseID review drafts where appropriate.
create or replace function public.move_horse_v2(
 p_horse_id uuid,
 p_site_id uuid,
 p_area_id uuid default null,
 p_unit_id uuid default null,
 p_moved_by text default null,
 p_move_note text default null,
 p_assigned_at timestamptz default now()
) returns uuid
language plpgsql security invoker set search_path=''
as $$
declare
 v_site uuid;
 v_area uuid;
 v_new uuid;
begin
 if p_unit_id is null then
   raise exception 'Choose a destination weide/stal before moving a horse';
 end if;
 select site_id,area_id into strict v_site,v_area
   from public.place_units where id=p_unit_id and active is true;
 if p_site_id is distinct from v_site or
    (p_area_id is not null and p_area_id is distinct from v_area) then
   raise exception 'Destination site/area mismatch';
 end if;
 perform public.optimus_move_group(
   array[p_horse_id]::uuid[],p_unit_id,pg_catalog.gen_random_uuid()
 );
 select id into strict v_new from public.horse_place_assignments
   where horse_id=p_horse_id and left_at is null
   order by assigned_at desc limit 1;
 return v_new;
end
$$;
revoke all on function public.move_horse_v2(uuid,uuid,uuid,uuid,text,text,timestamptz)
 from public, anon, authenticated;
grant execute on function public.move_horse_v2(uuid,uuid,uuid,uuid,text,text,timestamptz)
 to authenticated;

-- Tests required before production: anonymous writes/legacy RPC rejected,
-- active member can use optimus_move_group, direct writes limited to admin,
-- admin maps/blocks/group editing still works, old unauthenticated clients
-- receive a safe denial rather than silently bypassing authorization.
