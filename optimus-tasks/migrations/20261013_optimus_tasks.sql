-- Optimus Tasks: isolated tables and row-level security; does not change existing Optimus Manager data.
create schema if not exists optimus_tasks_private;
revoke all on schema optimus_tasks_private from public, anon, authenticated;
create table if not exists public.optimus_task_people (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(trim(name)) between 1 and 120),
 email text unique,
 phone text,
 user_id uuid unique references auth.users(id) on delete set null,
 role text not null default 'member' check (role in ('admin','member')),
 whatsapp_opt_in boolean not null default false,
 active boolean not null default true,
 created_at timestamptz not null default now()
);
create unique index if not exists optimus_task_people_email_unique on public.optimus_task_people(lower(email)) where email is not null;
create table if not exists public.optimus_task_items (
 id uuid primary key default gen_random_uuid(),
 title text not null check (length(trim(title)) between 1 and 300),
 notes text not null default '',
 person_id uuid not null references public.optimus_task_people(id) on delete restrict,
 due_date date not null,
 due_time time,
 priority text not null default 'normal' check (priority in ('normal','high')),
 status text not null default 'todo' check (status in ('todo','done')),
 completed_at timestamptz,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists optimus_task_items_person_date on public.optimus_task_items(person_id,due_date,status);
create index if not exists optimus_task_items_date on public.optimus_task_items(due_date);
create table if not exists public.optimus_task_deliveries (
 id uuid primary key default gen_random_uuid(),
 person_id uuid not null references public.optimus_task_people(id) on delete cascade,
 for_date date not null,
 sent_at timestamptz not null default now(),
 provider_id text,
 status text not null default 'sent' check(status in ('sent','failed')),
 error text,
 unique(person_id,for_date)
);
create table if not exists optimus_tasks_private.settings(key text primary key, value text not null);
-- Two one-time shared secrets hashed with pgcrypto; values are set during provisioning.

create or replace function optimus_tasks_private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.optimus_task_people p where p.user_id = (select auth.uid()) and p.role='admin' and p.active);
$$;
revoke all on function optimus_tasks_private.is_admin() from public, anon;
grant usage on schema optimus_tasks_private to authenticated;
grant execute on function optimus_tasks_private.is_admin() to authenticated;

alter table public.optimus_task_people enable row level security;
alter table public.optimus_task_items enable row level security;
alter table public.optimus_task_deliveries enable row level security;
revoke all on public.optimus_task_people, public.optimus_task_items, public.optimus_task_deliveries from anon;
grant select,insert,update,delete on public.optimus_task_people, public.optimus_task_items to authenticated;
grant select on public.optimus_task_deliveries to authenticated;

create policy optimus_task_people_read on public.optimus_task_people for select to authenticated
 using (user_id=(select auth.uid()) or (select optimus_tasks_private.is_admin()));
create policy optimus_task_people_insert on public.optimus_task_people for insert to authenticated
 with check ((select optimus_tasks_private.is_admin()));
create policy optimus_task_people_update on public.optimus_task_people for update to authenticated
 using ((select optimus_tasks_private.is_admin())) with check ((select optimus_tasks_private.is_admin()));
create policy optimus_task_people_delete on public.optimus_task_people for delete to authenticated
 using ((select optimus_tasks_private.is_admin()) and role <> 'admin');
create policy optimus_task_items_read on public.optimus_task_items for select to authenticated
 using ((select optimus_tasks_private.is_admin()) or exists(select 1 from public.optimus_task_people p where p.id=person_id and p.user_id=(select auth.uid()) and p.active));
create policy optimus_task_items_insert on public.optimus_task_items for insert to authenticated
 with check ((select optimus_tasks_private.is_admin()));
create policy optimus_task_items_update on public.optimus_task_items for update to authenticated
 using ((select optimus_tasks_private.is_admin())) with check ((select optimus_tasks_private.is_admin()));
create policy optimus_task_items_delete on public.optimus_task_items for delete to authenticated
 using ((select optimus_tasks_private.is_admin()));
create policy optimus_task_deliveries_read on public.optimus_task_deliveries for select to authenticated
 using ((select optimus_tasks_private.is_admin()));

create or replace function public.optimus_task_claim_profile() returns uuid
language plpgsql security definer set search_path = '' as $$
declare my_id uuid; my_email text; profile_id uuid;
begin
 my_id:=auth.uid();
 if my_id is null then raise exception 'Login required'; end if;
 select email into my_email from auth.users where id=my_id and email_confirmed_at is not null;
 if my_email is null then raise exception 'Verified email required'; end if;
 update public.optimus_task_people set user_id=my_id where lower(email)=lower(my_email) and (user_id is null or user_id=my_id) returning id into profile_id;
 return profile_id;
end; $$;
revoke all on function public.optimus_task_claim_profile() from public, anon;
grant execute on function public.optimus_task_claim_profile() to authenticated;

create or replace function public.optimus_task_setup_admin(setup_code text, person_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare my_id uuid; my_email text; profile_id uuid; pass_hash text;
begin
 my_id:=auth.uid();
 if my_id is null then raise exception 'Login required'; end if;
 select email into my_email from auth.users where id=my_id and email_confirmed_at is not null;
 if my_email is null then raise exception 'Verified email required'; end if;
 select value into pass_hash from optimus_tasks_private.settings where key='setup_hash';
 if pass_hash is null or pass_hash <> encode(extensions.digest(setup_code,'sha256'),'hex') then raise exception 'Invalid activation code'; end if;
 if exists(select 1 from public.optimus_task_people where role='admin') then raise exception 'Manager already activated'; end if;
 insert into public.optimus_task_people(name,email,user_id,role)
 values(left(trim(person_name),120),lower(my_email),my_id,'admin') returning id into profile_id;
 delete from optimus_tasks_private.settings where key='setup_hash';
 return profile_id;
end; $$;
revoke all on function public.optimus_task_setup_admin(text,text) from public, anon;
grant execute on function public.optimus_task_setup_admin(text,text) to authenticated;

create or replace function public.optimus_task_mark(task_id uuid, mark_done boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null or not exists (
  select 1 from public.optimus_task_items t join public.optimus_task_people p on p.id=t.person_id
  where t.id=task_id and ((p.user_id=auth.uid() and p.active) or optimus_tasks_private.is_admin())
 ) then raise exception 'Not authorized'; end if;
 update public.optimus_task_items set status=case when mark_done then 'done' else 'todo' end,
 completed_at=case when mark_done then now() else null end, updated_at=now() where id=task_id;
end; $$;
revoke all on function public.optimus_task_mark(uuid,boolean) from public, anon;
grant execute on function public.optimus_task_mark(uuid,boolean) to authenticated;

create or replace function public.optimus_task_digests(secret text)
returns table(person_id uuid, name text, phone text, for_date date, task_lines jsonb)
language plpgsql security definer set search_path = '' as $$
begin
 if not exists(select 1 from optimus_tasks_private.settings
 where key='cron_hash' and value=encode(extensions.digest(secret,'sha256'),'hex')) then
  raise exception 'Unauthorized';
 end if;
 return query
 select p.id,p.name,p.phone,timezone('Europe/Brussels',now())::date,
 coalesce((select jsonb_agg(jsonb_build_object('title',t.title,'time',to_char(t.due_time,'HH24:MI')) order by t.due_time nulls last,t.created_at)
  from public.optimus_task_items t where t.person_id=p.id and t.due_date=timezone('Europe/Brussels',now())::date and t.status='todo'),'[]'::jsonb)
 from public.optimus_task_people p
 where p.active and p.whatsapp_opt_in and p.phone is not null and p.phone ~ '^\+[1-9][0-9]{7,14}$'
 and exists(select 1 from public.optimus_task_items t where t.person_id=p.id and t.due_date=timezone('Europe/Brussels',now())::date and t.status='todo')
 and not exists(select 1 from public.optimus_task_deliveries d where d.person_id=p.id and d.for_date=timezone('Europe/Brussels',now())::date and d.status='sent');
end; $$;
revoke all on function public.optimus_task_digests(text) from public;
grant execute on function public.optimus_task_digests(text) to anon;

create or replace function public.optimus_task_delivery_log(secret text, person uuid, day date, provider text, ok boolean, details text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if not exists(select 1 from optimus_tasks_private.settings where key='cron_hash' and value=encode(extensions.digest(secret,'sha256'),'hex')) then raise exception 'Unauthorized'; end if;
 insert into public.optimus_task_deliveries(person_id,for_date,provider_id,status,error)
 values(person,day,left(provider,200),case when ok then 'sent' else 'failed' end,left(details,300))
 on conflict(person_id,for_date) do update set sent_at=now(),provider_id=excluded.provider_id,status=excluded.status,error=excluded.error;
end; $$;
revoke all on function public.optimus_task_delivery_log(text,uuid,date,text,boolean,text) from public;
grant execute on function public.optimus_task_delivery_log(text,uuid,date,text,boolean,text) to anon;