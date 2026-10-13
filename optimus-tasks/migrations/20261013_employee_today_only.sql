-- Restrict employees to today's own tasks and allow only completion by scoped RPC.
-- Already applied on Optimus Supabase on 2026-10-13.
drop policy if exists optimus_task_items_read on public.optimus_task_items;
create policy optimus_task_items_read on public.optimus_task_items for select to authenticated
using ((select optimus_tasks_private.is_admin()) or
 (due_date = timezone('Europe/Brussels', now())::date and exists (
   select 1 from public.optimus_task_people p
   where p.id=optimus_task_items.person_id
   and p.user_id=(select auth.uid()) and p.active)));

create or replace function public.optimus_task_mark(task_id uuid,mark_done boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare allowed boolean;
begin
 if auth.uid() is null then raise exception 'Login required'; end if;
 select exists (select 1 from public.optimus_task_items t
  join public.optimus_task_people p on p.id=t.person_id
  where t.id=task_id and (optimus_tasks_private.is_admin() or
  (p.user_id=auth.uid() and p.active and
   t.due_date=timezone('Europe/Brussels',now())::date))) into allowed;
 if not allowed then raise exception 'Not authorized to change this task'; end if;
 update public.optimus_task_items
 set status=case when mark_done then 'done' else 'todo' end,
 completed_at=case when mark_done then now() else null end,updated_at=now()
 where id=task_id;
end;$$;
revoke all on function public.optimus_task_mark(uuid,boolean) from public,anon;
grant execute on function public.optimus_task_mark(uuid,boolean) to authenticated;
