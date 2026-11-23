-- Atomic, audited group transfers. Apply after 202611200001; test in staging.
-- The public PostgREST RPC is SECURITY INVOKER; privileged implementation is in
-- a private, non-exposed schema and re-checks the verified active caller.
create schema if not exists optimus_private;
revoke all on schema optimus_private from public, anon;
grant usage on schema optimus_private to authenticated;

create table if not exists public.optimus_move_batches (
 id uuid primary key,
 horse_ids uuid[] not null,
 destination_unit uuid not null references public.place_units(id),
 moved_count integer not null,
 created_by uuid not null,
 created_at timestamptz not null default now()
);
alter table public.optimus_move_batches enable row level security;
revoke all on public.optimus_move_batches from anon, authenticated;

create or replace function optimus_private.move_group_impl(
 p_horse_ids uuid[], p_destination_unit uuid, p_request_id uuid
) returns integer
language plpgsql security definer set search_path = ''
as $$
declare
 v_profile jsonb;
 v_unit public.place_units%rowtype;
 v_site public.sites%rowtype;
 v_id uuid;
 v_old_site uuid;
 v_old_unit uuid;
 v_old_site_name text;
 v_legacy_snapshot text;
 v_moved integer := 0;
 v_occupied integer;
 v_incoming integer;
 v_previous public.optimus_move_batches%rowtype;
 v_now timestamptz := pg_catalog.now();
 v_name text;
begin
 if (select auth.uid()) is null then raise exception 'Login required'; end if;
 v_profile := public.optimus_task_my_profile();
 if v_profile is null or
    coalesce((v_profile->>'active')::boolean,false) is false or
    (v_profile->>'role') not in ('admin','member','planner') then
   raise exception 'Active stable staff account required';
 end if;
 if p_request_id is null or p_destination_unit is null or
    coalesce(pg_catalog.cardinality(p_horse_ids),0)<1 or
    coalesce(pg_catalog.cardinality(p_horse_ids),0)>200 or
    pg_catalog.array_position(p_horse_ids,null) is not null or
    (select count(distinct chosen.horse_id) from pg_catalog.unnest(p_horse_ids) as chosen(horse_id))
      <> pg_catalog.cardinality(p_horse_ids)
 then
  raise exception 'Invalid group move request';
 end if;
 -- A duplicate network submission returns the first result, never moves twice.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
 select * into v_previous from public.optimus_move_batches where id=p_request_id;
 if found then
   if v_previous.destination_unit<>p_destination_unit or
      v_previous.horse_ids<>p_horse_ids or v_previous.created_by<>(select auth.uid())
   then raise exception 'Request ID already used'; end if;
   return v_previous.moved_count;
 end if;
 select * into strict v_unit from public.place_units where id=p_destination_unit and active is true for update;
 select * into strict v_site from public.sites where id=v_unit.site_id and active is true;
 if public.is_place_blocked(v_unit.site_id,v_unit.area_id,v_unit.id,v_now)
 then raise exception 'Destination blocked'; end if;
 -- Consistent ordering serializes concurrent changes to the same horses.
 perform 1 from public.horses where id=any(p_horse_ids) order by id for update;
 if (select count(*) from public.horses where id=any(p_horse_ids) and active is true) <> pg_catalog.cardinality(p_horse_ids)
 then raise exception 'One or more horses are missing or inactive'; end if;
 -- A unit's positive capacity is an enforced maximum. Zero/NULL means unspecified.
 if v_unit.capacity is not null and v_unit.capacity > 0 then
   select count(*) into v_occupied
     from public.horse_place_assignments
     where unit_id=v_unit.id and left_at is null;
   select count(*) into v_incoming
     from public.horses h
     where h.id=any(p_horse_ids) and not exists(
       select 1 from public.horse_place_assignments a
       where a.horse_id=h.id and a.unit_id=v_unit.id and a.left_at is null
     );
   if v_occupied+v_incoming > v_unit.capacity then
     raise exception 'Destination capacity exceeded (max %, current %, incoming %)',
       v_unit.capacity,v_occupied,v_incoming;
   end if;
 end if;
 v_name := coalesce(nullif(v_profile->>'name',''),(select auth.uid())::text);
 foreach v_id in array p_horse_ids loop
   v_old_site:=null;
   v_old_unit:=null;
   select site_id,unit_id into v_old_site,v_old_unit
     from public.horse_place_assignments
     where horse_id=v_id and left_at is null
     order by assigned_at desc limit 1 for update;
   -- A horse without a current assignment may be placed for the first time.
   -- This does not invent a previous site or create an unjustified HorseID alert.
   if v_old_site is not null and v_old_unit is not distinct from v_unit.id
      and v_old_site=v_unit.site_id then continue; end if;
   if (select count(*) from public.horse_place_assignments
       where horse_id=v_id and left_at is null)>1 then
      raise exception 'Horse % has multiple current assignments; resolve first',v_id;
   end if;
   if v_old_site is not null then
     update public.horse_place_assignments
        set left_at=v_now where horse_id=v_id and left_at is null;
   end if;
   -- Retain the original legacy location fields in the assignment history
   -- before updating those fields for compatibility with the old horse fiche.
   select pg_catalog.jsonb_build_object(
     'stable_location',stable_location,'box_number',box_number,'pasture_name',pasture_name
   )::text into v_legacy_snapshot from public.horses where id=v_id;
   insert into public.horse_place_assignments
      (horse_id,site_id,area_id,unit_id,assigned_at,moved_by,move_note)
   values(v_id,v_unit.site_id,v_unit.area_id,v_unit.id,v_now,v_name,
      (case when v_old_site is null
         then 'Initial placement; previous legacy fields: '||v_legacy_snapshot
         else 'Optimus group move' end)||' | batch: '||p_request_id::text);
   update public.horses
      set stable_location=v_site.name,
          box_number=case when v_unit.unit_type::text='stable'
            then pg_catalog.regexp_replace(v_unit.name,'^stable[[:space:]]*','','i') else null end,
          pasture_name=case when v_unit.unit_type::text<>'stable' then v_unit.name else null end
      where id=v_id;
   if v_old_site is not null and v_old_site<>v_unit.site_id then
      select name into strict v_old_site_name from public.sites where id=v_old_site;
      insert into public.optimus_horseid_outbox
         (movement_key,horse_id,horse_name,chip_number,
          from_site_id,to_site_id,from_site_name,to_site_name,
          from_establishment,to_establishment,movement_at,status,created_by)
      select p_request_id::text||':'||v_id::text,h.id,h.name,null,
             v_old_site,v_unit.site_id,v_old_site_name,v_site.name,
             null,null,v_now,'draft',(select auth.uid())
        from public.horses h where h.id=v_id;
      -- A changed site is not proof of a changed HorseID establishment.
      -- These drafts remain unsent pending registration number verification.
   end if;
   v_moved:=v_moved+1;
 end loop;
 insert into public.optimus_move_batches(id,horse_ids,destination_unit,moved_count,created_by)
 values(p_request_id,p_horse_ids,p_destination_unit,v_moved,(select auth.uid()));
 return v_moved;
end
$$;
revoke all on function optimus_private.move_group_impl(uuid[],uuid,uuid) from public, anon, authenticated;
grant execute on function optimus_private.move_group_impl(uuid[],uuid,uuid) to authenticated;

create or replace function public.optimus_move_group(
 p_horse_ids uuid[], p_destination_unit uuid, p_request_id uuid
) returns integer
language sql security invoker set search_path=''
as $$
 select optimus_private.move_group_impl(p_horse_ids,p_destination_unit,p_request_id);
$$;
revoke all on function public.optimus_move_group(uuid[],uuid,uuid) from public, anon, authenticated;
grant execute on function public.optimus_move_group(uuid[],uuid,uuid) to authenticated;
-- All history and outbox changes roll back together on error. No email calls.
