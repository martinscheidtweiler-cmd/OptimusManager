-- STAGING ONLY until legacy VetTab/HorsesTab and any external reporting are tested.
-- Advisor-confirmed legacy medical tables with RLS disabled or publicly writable.
-- Requires 202611200003 (optimus_is_manager_admin).
do $$
declare t text; pol record;
begin
 foreach t in array array[
   'deworming_records','farrier_visits','horse_xray_records',
   'horse_lab_results','medicine_issuances','medicine_usage','medicines',
   'vaccination_passport_status','vaccination_records'
 ] loop
   execute format('alter table public.%I enable row level security',t);
   for pol in
     select policyname from pg_catalog.pg_policies
      where schemaname='public' and tablename=t
   loop
     execute format('drop policy if exists %I on public.%I',pol.policyname,t);
   end loop;
   execute format(
     'create policy %I on public.%I for select to authenticated using ((select public.optimus_is_manager_admin()))',
      t||'_opt_admin_select',t);
   execute format(
     'create policy %I on public.%I for insert to authenticated with check ((select public.optimus_is_manager_admin()))',
      t||'_opt_admin_insert',t);
   execute format(
     'create policy %I on public.%I for update to authenticated using ((select public.optimus_is_manager_admin())) with check ((select public.optimus_is_manager_admin()))',
      t||'_opt_admin_update',t);
   execute format(
     'create policy %I on public.%I for delete to authenticated using ((select public.optimus_is_manager_admin()))',
      t||'_opt_admin_delete',t);
   execute format('revoke all on public.%I from anon, authenticated',t);
   execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 end loop;
end $$;

-- Nested medicine views must honor the RLS of their underlying tables,
-- instead of using the view owner's privileges.
alter view public.medicine_register_view set (security_invoker=true);
alter view public.medicine_batch_stock_view set (security_invoker=true);
alter view public.medicine_stock_view set (security_invoker=true);
alter view public.medicine_expiry_warning_view set (security_invoker=true);
revoke all on public.medicine_register_view,public.medicine_batch_stock_view,
 public.medicine_stock_view,public.medicine_expiry_warning_view from anon,authenticated;
grant select on public.medicine_register_view,public.medicine_batch_stock_view,
 public.medicine_stock_view,public.medicine_expiry_warning_view to authenticated;

-- Never migrate without testing medical history, medicine register views and
-- the original veterinary screens as admin; non-admin medical access must fail.
