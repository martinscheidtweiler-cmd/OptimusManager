-- Additive staff-phone reliability changes. Existing rows and history are preserved.
alter table public.staff_paired_devices
  add column if not exists last_seen_at timestamptz;
alter table public.staff_paired_devices
  add column if not exists gps_enabled boolean not null default false;

create table if not exists public.staff_phone_action_receipts (
  device_id uuid not null references public.staff_paired_devices(id) on delete cascade,
  request_id uuid not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key (device_id, request_id)
);
alter table public.staff_phone_action_receipts enable row level security;
revoke all on public.staff_phone_action_receipts from public, anon, authenticated;

create or replace function public.staff_pair_admin(
  operation text,
  device_label text default null,
  device uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  secret text;
  new_id uuid;
begin
  if auth.uid() is null or not staff_private.is_admin() then
    raise exception 'Admin required';
  end if;
  if operation = 'create' then
    if length(trim(coalesce(device_label, ''))) not between 1 and 80 then
      raise exception 'Invalid label';
    end if;
    secret := encode(extensions.gen_random_bytes(32), 'hex');
    insert into public.staff_paired_devices(label, token_hash)
    values (trim(device_label), extensions.digest(secret, 'sha256'))
    returning id into new_id;
    return jsonb_build_object('id', new_id, 'code', secret);
  elsif operation = 'list' then
    return coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'label', label, 'active', active,
        'created_at', created_at, 'last_seen_at', last_seen_at
      ) order by created_at)
      from public.staff_paired_devices
    ), '[]'::jsonb);
  elsif operation = 'rename' then
    if length(trim(coalesce(device_label, ''))) not between 1 and 80 then
      raise exception 'Invalid label';
    end if;
    update public.staff_paired_devices
       set label = trim(device_label)
     where id = device and active;
    if not found then raise exception 'Active device not found'; end if;
    return jsonb_build_object('ok', true);
  elsif operation = 'revoke' then
    perform 1 from public.staff_paired_devices where id = device for update;
    if not found then raise exception 'Device not found'; end if;
    update public.staff_entries
       set ended_at = greatest(started_at, now())
     where ended_at is null
       and shift_id in (select id from public.staff_shifts where paired_device_id = device and ended_at is null);
    delete from public.staff_positions
     where shift_id in (select id from public.staff_shifts where paired_device_id = device);
    update public.staff_shifts set ended_at = greatest(started_at, now())
     where paired_device_id = device and ended_at is null;
    update public.staff_paired_devices set active = false, gps_enabled = false where id = device;
    return jsonb_build_object('ok', true);
  else
    raise exception 'Invalid operation';
  end if;
end;
$$;
revoke all on function public.staff_pair_admin(text, text, uuid) from public, anon;
grant execute on function public.staff_pair_admin(text, text, uuid) to authenticated;

-- Replace the old function signature atomically so PostgREST cannot see two
-- overloads with the same default arguments. The original six arguments still
-- work; request_id and occurred_at are optional for existing callers.
drop function if exists public.staff_phone(text, text, bigint, double precision, double precision, double precision);
create function public.staff_phone(
  code text,
  action text,
  target bigint default null,
  latitude double precision default null,
  longitude double precision default null,
  precision_m double precision default null,
  request_id uuid default null,
  occurred_at timestamptz default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  d uuid;
  s uuid;
  v_request_id uuid := request_id;
  current_entry_started timestamptz;
  event_time timestamptz := coalesce(occurred_at, now());
  result jsonb;
begin
  if code is null or code !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid device code';
  end if;
  if event_time > now() + interval '5 minutes' or event_time < now() - interval '31 days' then
    raise exception 'Device event time is outside the accepted range';
  end if;

  select id into d
    from public.staff_paired_devices
   where token_hash = extensions.digest(code, 'sha256') and active
   for update;
  if d is null then raise exception 'Device not authorized'; end if;
  update public.staff_paired_devices set last_seen_at = now() where id = d;

  if request_id is not null then
    select response into result
      from public.staff_phone_action_receipts
     where device_id = d and staff_phone_action_receipts.request_id = v_request_id;
    if found then return result; end if;
  end if;

  select id into s from public.staff_shifts where paired_device_id = d and ended_at is null;

  if action = 'load' then
    null;
  elsif action = 'begin' then
    if s is not null then raise exception 'Shift already active'; end if;
    if not exists (select 1 from public.staff_workers where id = target and active) then
      raise exception 'Invalid worker';
    end if;
    insert into public.staff_shifts(paired_device_id, worker_id, started_at)
    values (d, target, event_time) returning id into s;
  elsif s is null then
    raise exception 'No active shift';
  elsif action = 'task' then
    if not exists (
      select 1 from public.staff_tasks t
      join public.staff_locations l on l.id = t.location_id
      where t.id = target and t.active and l.active
    ) then raise exception 'Invalid task'; end if;
    select started_at into current_entry_started
      from public.staff_entries where shift_id = s and ended_at is null for update;
    if current_entry_started is not null and event_time < current_entry_started then
      raise exception 'Task events must be in chronological order';
    end if;
    update public.staff_entries set ended_at = event_time
     where shift_id = s and ended_at is null;
    insert into public.staff_entries(shift_id, task_id, started_at)
    values (s, target, event_time);
  elsif action in ('stop', 'end') then
    select started_at into current_entry_started
      from public.staff_entries where shift_id = s and ended_at is null for update;
    if current_entry_started is not null and event_time < current_entry_started then
      raise exception 'Task events must be in chronological order';
    end if;
    update public.staff_entries set ended_at = event_time
     where shift_id = s and ended_at is null;
    if action = 'end' then
      update public.staff_shifts set ended_at = greatest(event_time, started_at) where id = s;
      delete from public.staff_positions where shift_id = s;
      update public.staff_paired_devices set gps_enabled = false where id = d;
      s := null;
    end if;
  elsif action = 'gps_start' then
    if s is null then raise exception 'No active shift'; end if;
    update public.staff_paired_devices set gps_enabled = true where id = d;
  elsif action = 'gps_stop' then
    update public.staff_paired_devices set gps_enabled = false where id = d;
    if s is not null then delete from public.staff_positions where shift_id = s; end if;
  elsif action = 'position' then
    if latitude is null or longitude is null then raise exception 'Location is required'; end if;
    if not exists (select 1 from public.staff_paired_devices where id = d and gps_enabled) then
      raise exception 'Location sharing is disabled';
    end if;
    insert into public.staff_positions(shift_id, lat, lon, accuracy, updated_at)
    values (s, latitude, longitude, precision_m, now())
    on conflict (shift_id) do update
      set lat = excluded.lat, lon = excluded.lon,
          accuracy = excluded.accuracy, updated_at = now();
    return jsonb_build_object('ok', true);
  elsif action = 'clear_position' then
    update public.staff_paired_devices set gps_enabled = false where id = d;
    delete from public.staff_positions where shift_id = s;
    return jsonb_build_object('ok', true);
  else
    raise exception 'Invalid action';
  end if;

  select jsonb_build_object(
    'workers', coalesce((select jsonb_agg(to_jsonb(w) order by w.name) from public.staff_workers w where active), '[]'::jsonb),
    'locations', coalesce((select jsonb_agg(to_jsonb(l) order by l.id) from public.staff_locations l where active), '[]'::jsonb),
    'tasks', coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from public.staff_tasks t join public.staff_locations l on l.id = t.location_id where t.active and l.active), '[]'::jsonb),
    'contacts', coalesce((select jsonb_agg(to_jsonb(c) order by c.name) from public.staff_contacts c where active), '[]'::jsonb),
    'shift', (select to_jsonb(sh) from public.staff_shifts sh where id = s),
    'entry', (select to_jsonb(e) from public.staff_entries e where shift_id = s and ended_at is null),
    'device', (select jsonb_build_object('id', pd.id, 'label', pd.label, 'gps_enabled', pd.gps_enabled, 'last_seen_at', pd.last_seen_at) from public.staff_paired_devices pd where pd.id = d)
  ) into result;

  if v_request_id is not null then
    insert into public.staff_phone_action_receipts(device_id, request_id, response)
    values (d, v_request_id, result);
  end if;
  return result;
end;
$$;
revoke all on function public.staff_phone(text, text, bigint, double precision, double precision, double precision, uuid, timestamptz) from public;
grant execute on function public.staff_phone(text, text, bigint, double precision, double precision, double precision, uuid, timestamptz) to anon, authenticated;
notify pgrst, 'reload schema';
