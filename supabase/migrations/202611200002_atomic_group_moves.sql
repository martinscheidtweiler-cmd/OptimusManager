-- Review and apply in staging first. This function performs the entire group move
-- in one transaction; any error rolls back every horse's assignment and denormalized fields.
-- It deliberately does not send email or infer HorseID establishment IDs from site names.
create or replace function public.optimus_move_group(
 p_horse_ids uuid[],
 p_destination_unit uuid,
 p_request_id uuid
) returns integer
language plpgsql security invoker
set search_path = public, pg_temp
as $$
declare
 v_profile jsonb;
 v_unit public.place_units%rowtype;
 v_site public.sites%rowtype;
 v_id uuid;
 v_old_site uuid;
 v_old_unit uuid;
 v_count integer := 0;
 v_now timestamptz := now();
 v_name text;
begin
 if auth.uid() is null then raise exception 'Login required'; end if;
 v_profile := public.optimus_task_my_profile();
 if v_profile is null or v_profile->>'role' <> 'admin' or coalesce((v_profile->>'active')::boolean,false) = false then
  raise exception 'Manager access required';
 end if;
 if p_request_id is null or p_horse_ids is null or cardinality(p_horse_ids) = 0 or cardinality(p_horse_ids) > 200 then
  raise exception 'Invalid movement request';
 end if;
 if (select count(distinct x) from unnest(p_horse_ids) x) <> cardinality(p_horse_ids) then
  raise exception 'Duplicate horse IDs';
 end if;
 select * into strict v_unit from public.place_units where id=p_destination_unit and active=true;
 select * into strict v_site from public.sites where id=v_unit.site_id and active=true;
 if public.is_place_blocked(v_unit.site_id,v_unit.area_id,v_unit.id,v_now) then
  raise exception 'Destination is blocked';
 end if;
 -- Serialize concurrent movement requests for the same horses.
 perform 1 from public.horses where id=any(p_horse_ids) order by id for update;
 if (select count(*) from public.horses where id=any(p_horse_ids) and active=true) <> cardinality(p_horse_ids) then
  raise exception 'One or more horses are missing or inactive';
 end if;
 v_name := coalesce(nullif(v_profile->>'name',''), auth.uid()::text);
 foreach v_id in array p_horse_ids loop
  select site_id,unit_id into v_old_site,v_old_unit
    from public.horse_place_assignments
   where horse_id=v_id and left_at is null
   order by assigned_at desc limit 1 for update;
  if v_old_site is null then raise exception 'Horse % has no current assignment',v_id; end if;
  if v_old_unit is not distinct from v_unit.id then continue; end if;
  update public.horse_place_assignments set left_at=v_now where horse_id=v_id and left_at is null;
  insert into public.horse_place_assignments(horse_id,site_id,area_id,unit_id,assigned_at,moved_by,move_note)
  values(v_id,v_unit.site_id,v_unit.area_id,v_unit.id,v_now,v_name,'Optimus group move '||p_request_id::text);
  update public.horses
     set stable_location=v_site.name,
         box_number=case when v_unit.unit_type::text='stable' then regexp_replace(v_unit.name,'^stable[[:space:]]*','','i') else null end,
         pasture_name=case when v_unit.unit_type::text<>'stable' then v_unit.name else null end
   where id=v_id;
  v_count := v_count+1;
 end loop;
 return v_count;
end
$$;
revoke all on function public.optimus_move_group(uuid[],uuid,uuid) from public, anon;
grant execute on function public.optimus_move_group(uuid[],uuid,uuid) to authenticated;
-- The function is security invoker: existing RLS on all underlying tables still applies.
-- Validate required grants/RLS policies in staging before activating this endpoint.
