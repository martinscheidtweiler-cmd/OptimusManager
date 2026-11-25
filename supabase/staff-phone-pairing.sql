create table public.staff_paired_devices(id uuid primary key default gen_random_uuid(),label text not null,token_hash bytea not null unique,active boolean not null default true,created_at timestamptz not null default now());
alter table public.staff_paired_devices enable row level security;
revoke all on public.staff_paired_devices from anon,authenticated;
alter table public.staff_shifts alter column device_id drop not null;
alter table public.staff_shifts add column paired_device_id uuid references public.staff_paired_devices(id);
alter table public.staff_shifts add constraint staff_exactly_one_device check ((device_id is null) <> (paired_device_id is null));
create unique index staff_one_shift_paired on public.staff_shifts(paired_device_id) where ended_at is null and paired_device_id is not null;
create function public.staff_pair_admin(operation text, device_label text default null, device uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare secret text; new_id uuid; begin
if auth.uid() is null or not staff_private.is_admin() then raise exception 'Admin required'; end if;
if operation='create' then
if length(trim(coalesce(device_label,''))) not between 1 and 80 then raise exception 'Invalid label'; end if;
secret:=encode(extensions.gen_random_bytes(32),'hex');
insert into public.staff_paired_devices(label,token_hash) values(trim(device_label),extensions.digest(secret,'sha256')) returning id into new_id;
return jsonb_build_object('id',new_id,'code',secret);
elsif operation='list' then return coalesce((select jsonb_agg(jsonb_build_object('id',id,'label',label,'active',active) order by created_at) from public.staff_paired_devices),'[]'::jsonb);
elsif operation='revoke' then
perform 1 from public.staff_paired_devices where id=device for update;
update public.staff_entries set ended_at=now() where ended_at is null and shift_id in(select id from public.staff_shifts where paired_device_id=device and ended_at is null);
delete from public.staff_positions where shift_id in(select id from public.staff_shifts where paired_device_id=device);
update public.staff_shifts set ended_at=now() where paired_device_id=device and ended_at is null;
update public.staff_paired_devices set active=false where id=device;
return jsonb_build_object('ok',true);
else raise exception 'Invalid operation'; end if; end $$;
revoke all on function public.staff_pair_admin(text,text,uuid) from public,anon;
grant execute on function public.staff_pair_admin(text,text,uuid) to authenticated;
create function public.staff_phone(code text, action text, target bigint default null, latitude double precision default null, longitude double precision default null, precision_m double precision default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare d uuid; s uuid; result jsonb; begin
if code is null or code !~ '^[0-9a-f]{64}$' then raise exception 'Invalid device code'; end if;
select id into d from public.staff_paired_devices where token_hash=extensions.digest(code,'sha256') and active for update;
if d is null then raise exception 'Device not authorized'; end if;
select id into s from public.staff_shifts where paired_device_id=d and ended_at is null;
if action='begin' then
if s is not null then raise exception 'Shift already active'; end if;
if not exists(select 1 from public.staff_workers where id=target and active) then raise exception 'Invalid worker'; end if;
insert into public.staff_shifts(paired_device_id,worker_id) values(d,target) returning id into s;
elsif action='load' then
null;
elsif s is null then raise exception 'No active shift';
elsif action='task' then
if not exists(select 1 from public.staff_tasks t join public.staff_locations l on l.id=t.location_id where t.id=target and t.active and l.active) then raise exception 'Invalid task'; end if;
update public.staff_entries set ended_at=now() where shift_id=s and ended_at is null;
insert into public.staff_entries(shift_id,task_id) values(s,target);
elsif action in ('stop','end') then
update public.staff_entries set ended_at=now() where shift_id=s and ended_at is null;
if action='end' then update public.staff_shifts set ended_at=now() where id=s; delete from public.staff_positions where shift_id=s; s:=null; end if;
elsif action='position' then
insert into public.staff_positions(shift_id,lat,lon,accuracy,updated_at) values(s,latitude,longitude,precision_m,now()) on conflict(shift_id) do update set lat=excluded.lat,lon=excluded.lon,accuracy=excluded.accuracy,updated_at=now();
return jsonb_build_object('ok',true);
elsif action='clear_position' then delete from public.staff_positions where shift_id=s; return jsonb_build_object('ok',true);
else raise exception 'Invalid action'; end if;
select jsonb_build_object('workers',coalesce((select jsonb_agg(to_jsonb(w) order by w.name) from public.staff_workers w where active),'[]'::jsonb),'locations',coalesce((select jsonb_agg(to_jsonb(l) order by l.id) from public.staff_locations l where active),'[]'::jsonb),'tasks',coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from public.staff_tasks t join public.staff_locations l on l.id=t.location_id where t.active and l.active),'[]'::jsonb),'contacts',coalesce((select jsonb_agg(to_jsonb(c) order by c.name) from public.staff_contacts c where active),'[]'::jsonb),'shift',(select to_jsonb(sh) from public.staff_shifts sh where id=s),'entry',(select to_jsonb(e) from public.staff_entries e where shift_id=s and ended_at is null)) into result;
return result; end $$;
revoke all on function public.staff_phone(text,text,bigint,double precision,double precision,double precision) from public;
grant execute on function public.staff_phone(text,text,bigint,double precision,double precision,double precision) to anon,authenticated;
