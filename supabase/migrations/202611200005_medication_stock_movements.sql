-- Stage after 202611200003. Signed, audited stock adjustments in one transaction.
create or replace function public.optimus_adjust_medication_stock(
  p_stock_id uuid,
  p_delta numeric,
  p_reason text,
  p_horse_id uuid default null,
  p_authorized_by text default null
) returns numeric
language plpgsql security invoker set search_path=''
as $$
declare v_profile jsonb; v_current numeric; v_new numeric;
begin
 if (select auth.uid()) is null then raise exception 'Login required'; end if;
 v_profile:=public.optimus_task_my_profile();
 if v_profile is null or v_profile->>'role'<>'admin'
   or coalesce((v_profile->>'active')::boolean,false) is false
 then raise exception 'Only active administrators may adjust medication'; end if;
 if p_stock_id is null or p_delta is null or p_delta=0 or
    p_delta<>p_delta or pg_catalog.abs(p_delta)>100000 then
   raise exception 'Invalid stock adjustment'; end if;
 if pg_catalog.length(pg_catalog.btrim(coalesce(p_reason,'')))<3 then
   raise exception 'A reason of at least 3 characters is required'; end if;
 select quantity into strict v_current
   from public.optimus_medication_stock
   where id=p_stock_id for update;
 v_new:=v_current+p_delta;
 if v_new<0 then raise exception 'Insufficient medication stock'; end if;
 update public.optimus_medication_stock
    set quantity=v_new,updated_at=pg_catalog.now()
    where id=p_stock_id;
 insert into public.optimus_medication_movements
  (stock_id,horse_id,delta,reason,authorized_by,performed_by)
 values(p_stock_id,p_horse_id,p_delta,pg_catalog.btrim(p_reason),
        nullif(pg_catalog.btrim(coalesce(p_authorized_by,'')),''),
        (select auth.uid()));
 return v_new;
end
$$;
revoke all on function public.optimus_adjust_medication_stock(uuid,numeric,text,uuid,text)
 from public,anon,authenticated;
grant execute on function public.optimus_adjust_medication_stock(uuid,numeric,text,uuid,text)
 to authenticated;
-- Protect the stock ledger against editing historical quantities.
drop policy if exists optimus_medication_movements_admin_update
 on public.optimus_medication_movements;
revoke update,delete,truncate on public.optimus_medication_movements from authenticated,anon;
