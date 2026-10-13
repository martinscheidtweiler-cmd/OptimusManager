-- Fix: reliably resolve the signed-in member's own profile, bypassing
-- browser-side RLS lookup issues without exposing any other users.
create or replace function public.optimus_task_my_profile() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare my_id uuid; confirmed_email text; my_profile record;
begin
 my_id := auth.uid();
 if my_id is null then raise exception 'Login required'; end if;
 select email into confirmed_email from auth.users
   where id = my_id and email_confirmed_at is not null;
 if confirmed_email is null then raise exception 'Verified email required'; end if;
 update public.optimus_task_people set user_id = my_id
 where lower(email) = lower(confirmed_email)
   and (user_id is null or user_id = my_id) and active = true;
 select id,name,email,role,active into my_profile
 from public.optimus_task_people where user_id = my_id limit 1;
 if not found then return null; end if;
 return jsonb_build_object('id', my_profile.id,
   'name', my_profile.name, 'email', my_profile.email,
   'role', my_profile.role, 'active', my_profile.active);
end;
$$;
revoke all on function public.optimus_task_my_profile() from public, anon;
grant execute on function public.optimus_task_my_profile() to authenticated;
