-- Apply after 202611200001 in staging; administrator-only access to clinical data.
-- This does not grant access to all authenticated users.
create or replace function public.optimus_is_manager_admin()
returns boolean language sql stable security definer
set search_path = ''
as $$
 select exists(
  select 1 from public.optimus_task_people p
  where p.user_id = (select auth.uid()) and p.active is true and p.role = 'admin'
 );
$$;
revoke all on function public.optimus_is_manager_admin() from public, anon;
grant execute on function public.optimus_is_manager_admin() to authenticated;
do $$
declare t text;
begin
 foreach t in array array[
  'optimus_care_events','optimus_medication_stock','optimus_medication_movements',
  'optimus_vet_cases','optimus_horseid_outbox'
 ] loop
  execute format('create policy %I on public.%I for select to authenticated using ((select public.optimus_is_manager_admin()))',t||'_admin_select',t);
  execute format('create policy %I on public.%I for insert to authenticated with check ((select public.optimus_is_manager_admin()))',t||'_admin_insert',t);
  execute format('create policy %I on public.%I for update to authenticated using ((select public.optimus_is_manager_admin())) with check ((select public.optimus_is_manager_admin()))',t||'_admin_update',t);
 end loop;
end $$;
grant select,insert,update on public.optimus_care_events,public.optimus_medication_stock,public.optimus_medication_movements,public.optimus_vet_cases,public.optimus_horseid_outbox to authenticated;
-- No DELETE policy. No automatic email sending.
