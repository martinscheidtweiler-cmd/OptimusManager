create schema if not exists staff_private;
revoke all on schema staff_private from public;
grant usage on schema staff_private to authenticated;
create table public.staff_workers(id bigint generated always as identity primary key,name text not null unique,active boolean not null default true);
create table public.staff_locations(id bigint generated always as identity primary key,name text not null unique,active boolean not null default true);
create table public.staff_tasks(id bigint generated always as identity primary key,location_id bigint not null references public.staff_locations(id),name text not null,active boolean not null default true,unique(location_id,name));
create table public.staff_contacts(id bigint generated always as identity primary key,name text not null unique,phone text,active boolean not null default true);
create table public.staff_devices(user_id uuid primary key references auth.users(id),label text not null,active boolean not null default true);
create table public.staff_shifts(id uuid primary key default gen_random_uuid(),device_id uuid not null references public.staff_devices(user_id),worker_id bigint not null references public.staff_workers(id),started_at timestamptz not null default now(),ended_at timestamptz,check(ended_at is null or ended_at>=started_at));
create unique index staff_one_shift_device on public.staff_shifts(device_id) where ended_at is null;
create unique index staff_one_shift_worker on public.staff_shifts(worker_id) where ended_at is null;
create table public.staff_entries(id uuid primary key default gen_random_uuid(),shift_id uuid not null references public.staff_shifts(id),task_id bigint not null references public.staff_tasks(id),started_at timestamptz not null default now(),ended_at timestamptz,check(ended_at is null or ended_at>=started_at));
create unique index staff_one_task_shift on public.staff_entries(shift_id) where ended_at is null;
create table public.staff_positions(shift_id uuid primary key references public.staff_shifts(id),lat double precision not null check(lat between -90 and 90),lon double precision not null check(lon between -180 and 180),accuracy double precision,updated_at timestamptz not null default now());
insert into public.staff_workers(name) values ('Dries'),('Veronique'),('Martin'),('George'),('Terry'),('Barat');
insert into public.staff_contacts(name) select name from public.staff_workers;
insert into public.staff_locations(name) values ('Serre'),('50'),('47b'),('Oostmal'),('Vremde'),('Paddock Paradise');
insert into public.staff_tasks(location_id,name)
select l.id,t.name
from (values
  ('47b','Voer geven aan de boxen'),('47b','Boxen uitmesten'),('47b','Stro geven in de boxen'),
  ('47b','Hooi geven in de boxen'),('47b','Mest uithalen uit 7 bigboxen'),
  ('47b','Mest uithalen uit winterpaddock'),('47b','Paarden binnen zetten'),
  ('47b','Paarden buiten zetten'),('47b','Andere'),
  ('50','Voer geven'),('50','Paarden buiten zetten'),('50','Boxen uitmesten'),
  ('50','Stro geven in de boxen'),('50','Hooi geven'),('50','Paarden binnen zetten'),
  ('50','Mest weghalen uit shelter 6'),('50','Andere'),
  ('Serre','Voer geven'),('Serre','Hooi geven'),('Serre','Mest weghalen'),
  ('Serre','Mest weghalen uit shelter 7'),
  ('Oostmal','Mest weghalen'),('Oostmal','Hooi geven'),
  ('Oostmal','Mest weghalen uit shelter 1'),('Oostmal','Mest weghalen uit shelter 2'),
  ('Oostmal','Mest weghalen uit shelter 3'),('Oostmal','Mest weghalen uit shelter 4'),
  ('Oostmal','Mest weghalen uit shelter 5'),
  ('Paddock Paradise','Mest weghalen'),('Paddock Paradise','Hooi geven'),
  ('Paddock Paradise','Voer geven'),
  ('Vremde','Mest weghalen'),('Vremde','Hooi geven'),('Vremde','Voer geven')
) as t(location_name,name)
join public.staff_locations l on l.name=t.location_name;
create function staff_private.is_admin() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.optimus_task_people where user_id=auth.uid() and active and role='admin') $$;
create function staff_private.is_device() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.staff_devices where user_id=auth.uid() and active) $$;
create function staff_private.owns_shift(s uuid) returns boolean language sql stable security definer set search_path='' as $$ select staff_private.is_device() and exists(select 1 from public.staff_shifts where id=s and device_id=auth.uid()) $$;
revoke all on all functions in schema staff_private from public;
grant execute on all functions in schema staff_private to authenticated;
do $$ declare t text; begin foreach t in array array['staff_workers','staff_locations','staff_tasks','staff_contacts','staff_devices','staff_shifts','staff_entries','staff_positions'] loop
execute format('alter table public.%I enable row level security',t);
execute format('revoke all on public.%I from anon, authenticated',t);
execute format('grant select on public.%I to authenticated',t);
execute format('create policy admin_read on public.%I for select to authenticated using (staff_private.is_admin())',t);
end loop;
foreach t in array array['staff_workers','staff_locations','staff_tasks','staff_contacts','staff_devices'] loop
execute format('grant insert, update on public.%I to authenticated',t);
execute format('create policy admin_write on public.%I for all to authenticated using (staff_private.is_admin()) with check (staff_private.is_admin())',t);
end loop;
foreach t in array array['staff_workers','staff_locations','staff_tasks','staff_contacts'] loop
execute format('create policy device_read on public.%I for select to authenticated using (staff_private.is_device() and active)',t);
end loop;
end $$;
create policy device_self on public.staff_devices for select to authenticated using (user_id=auth.uid() and active);
create policy own_shifts on public.staff_shifts for select to authenticated using (staff_private.is_device() and device_id=auth.uid());
create policy own_entries on public.staff_entries for select to authenticated using (staff_private.owns_shift(shift_id));
create function public.staff_action(action text,target bigint default null,latitude double precision default null,longitude double precision default null,precision_m double precision default null) returns uuid language plpgsql security definer set search_path='' as $$
declare s uuid; w uuid:=auth.uid(); begin
if w is null or not staff_private.is_device() then raise exception 'Device not authorized'; end if;
perform 1 from public.staff_devices where user_id=w for update;
select id into s from public.staff_shifts where device_id=w and ended_at is null;
if action='begin' then
if s is not null then raise exception 'Shift already active'; end if;
if not exists(select 1 from public.staff_workers where id=target and active) then raise exception 'Invalid worker'; end if;
insert into public.staff_shifts(device_id,worker_id) values(w,target) returning id into s;
elsif s is null then raise exception 'No active shift';
elsif action='task' then
if not exists(select 1 from public.staff_tasks t join public.staff_locations l on l.id=t.location_id where t.id=target and t.active and l.active) then raise exception 'Invalid task'; end if;
update public.staff_entries set ended_at=now() where shift_id=s and ended_at is null;
insert into public.staff_entries(shift_id,task_id) values(s,target);
elsif action='stop' or action='end' then
update public.staff_entries set ended_at=now() where shift_id=s and ended_at is null;
if action='end' then update public.staff_shifts set ended_at=now() where id=s; delete from public.staff_positions where shift_id=s; end if;
elsif action='position' then
insert into public.staff_positions(shift_id,lat,lon,accuracy,updated_at) values(s,latitude,longitude,precision_m,now()) on conflict(shift_id) do update set lat=excluded.lat,lon=excluded.lon,accuracy=excluded.accuracy,updated_at=now();
elsif action='clear_position' then delete from public.staff_positions where shift_id=s;
else raise exception 'Invalid action'; end if;
return s; end $$;
revoke all on function public.staff_action(text,bigint,double precision,double precision,double precision) from public,anon;
grant execute on function public.staff_action(text,bigint,double precision,double precision,double precision) to authenticated;
