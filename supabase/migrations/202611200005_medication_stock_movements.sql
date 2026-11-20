-- STAGING. Reuse existing medicine_issuances / medicine_usage and their
-- medicine_batch_stock_view; do not duplicate pharmaceutical stock balances.
-- Existing receipt forms already write a single medicine_issuances row.
-- This RPC guarantees one safe, audited usage/disposal per request.
create or replace function public.optimus_use_medicine_batch(
 p_issuance_id uuid,
 p_quantity integer,
 p_reason text,
 p_horse_id uuid,
 p_authorized_by text,
 p_action text,
 p_request_id uuid
) returns integer
language plpgsql security invoker set search_path=''
as $$
declare
 v_profile jsonb;
 v_batch public.medicine_issuances%rowtype;
 v_used bigint;
 v_remaining integer;
 v_horse_name text;
 v_notes text;
begin
 if (select auth.uid()) is null then raise exception 'Login required'; end if;
 v_profile := public.optimus_task_my_profile();
 if v_profile is null or v_profile->>'role'<>'admin' or
    coalesce((v_profile->>'active')::boolean,false) is false then
  raise exception 'Only active managers may use medication stock';
 end if;
 if p_issuance_id is null or p_request_id is null or
    p_quantity is null or p_quantity<=0 or p_quantity>100000 or
    p_action not in ('use','dispose') or p_action is null or
    pg_catalog.length(pg_catalog.btrim(coalesce(p_reason,'')))<3 then
  raise exception 'Invalid medicine movement';
 end if;
 select * into strict v_batch from public.medicine_issuances
   where id=p_issuance_id for update;
 if exists(select 1 from public.medicine_usage where id=p_request_id) then
   select coalesce(sum(quantity),0) into v_used
     from public.medicine_usage where issuance_id=p_issuance_id;
   return v_batch.quantity-v_used;
 end if;
 if p_action='use' and v_batch.expiry_date is not null and
    v_batch.expiry_date < current_date then
   raise exception 'Medication lot is expired';
 end if;
 if p_action='use' and v_batch.horse_scope='selected' and
    pg_catalog.cardinality(v_batch.horse_ids)>0 and
    (p_horse_id is null or not (p_horse_id=any(v_batch.horse_ids))) then
  raise exception 'Selected medicine batch is not allocated to this horse';
 end if;
 if p_horse_id is not null then
   select name into strict v_horse_name from public.horses where id=p_horse_id;
 end if;
 select coalesce(sum(quantity),0) into v_used from public.medicine_usage
   where issuance_id=p_issuance_id;
 v_remaining:=v_batch.quantity-v_used;
 if p_quantity>v_remaining then
  raise exception 'Insufficient batch stock: % available',v_remaining;
 end if;
 v_notes:=pg_catalog.left(pg_catalog.btrim(p_reason)||
  case when pg_catalog.length(pg_catalog.btrim(coalesce(p_authorized_by,'')))>0
   then ' | Goedgekeurd door: '||pg_catalog.btrim(p_authorized_by)
   else '' end,2000);
 insert into public.medicine_usage(
   id,medicine_id,issuance_id,usage_date,quantity,horse_scope,
   horse_ids,horse_names,notes
 ) values(
   p_request_id,v_batch.medicine_id,p_issuance_id,current_date,p_quantity,
   case when p_horse_id is null then 'all' else 'selected' end,
   case when p_horse_id is null then array[]::uuid[] else array[p_horse_id] end,
   case when p_horse_id is null then array[]::text[] else array[v_horse_name] end,
   (case when p_action='dispose' then 'Afvoer / vervallen: ' else '' end)||v_notes
 );
 return v_remaining-p_quantity;
end
$$;
revoke all on function public.optimus_use_medicine_batch(uuid,integer,text,uuid,text,text,uuid)
 from public,anon,authenticated;
grant execute on function public.optimus_use_medicine_batch(uuid,integer,text,uuid,text,text,uuid)
 to authenticated;
