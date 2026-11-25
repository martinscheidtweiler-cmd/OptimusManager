begin;
select plan(20);

select ok(not has_table_privilege('anon', 'public.staff_workers', 'select'), 'anonymous clients cannot read the worker table directly');
select ok(not has_table_privilege('anon', 'public.staff_shifts', 'select'), 'anonymous clients cannot read shift history directly');
select ok(not has_table_privilege('anon', 'public.staff_entries', 'select'), 'anonymous clients cannot read task history directly');
select ok(not has_table_privilege('anon', 'public.staff_positions', 'select'), 'anonymous clients cannot read device positions directly');
select ok(not has_table_privilege('anon', 'public.staff_paired_devices', 'select'), 'anonymous clients cannot read paired-device credentials');
select ok(not has_table_privilege('anon', 'public.staff_phone_action_receipts', 'select'), 'anonymous clients cannot read action receipts');
select ok(has_function_privilege('anon', 'public.staff_phone(text,text,bigint,double precision,double precision,double precision,uuid,timestamp with time zone)', 'execute'), 'anonymous clients may use only the code-gated phone RPC');
select ok(not has_function_privilege('anon', 'public.staff_pair_admin(text,text,uuid)', 'execute'), 'anonymous clients cannot use the admin RPC');
select ok(not has_table_privilege('anon', 'public.horses', 'select'), 'anonymous clients cannot read horse records directly');
select ok(not has_table_privilege('anon', 'public.medicines', 'select'), 'anonymous clients cannot read medical records directly');
select ok(not has_table_privilege('anon', 'public.staff_attendance', 'select'), 'anonymous clients cannot read legacy staff records');
select ok(not has_table_privilege('anon', 'public.horse_current_places_v2', 'select'), 'anonymous clients cannot read the horse location view');
select ok(not has_table_privilege('anon', 'public.medicine_stock_view', 'select'), 'anonymous clients cannot read the medicine stock view');
select ok(not has_function_privilege('anon', 'public.move_horse_v2(uuid,uuid,uuid,uuid,text,text,timestamp with time zone)', 'execute'), 'anonymous clients cannot move horses through the RPC');

do $$
declare
  worker_id bigint;
  task_id bigint;
  device_id uuid;
  pairing_code text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  insert into public.staff_workers(name, active)
  values ('__staff_phone_test_' || gen_random_uuid()::text, true)
  returning id into worker_id;
  insert into public.staff_paired_devices(label, token_hash, active)
  values ('__staff_phone_test', extensions.digest(pairing_code, 'sha256'), true)
  returning id into device_id;
  select min(id) into task_id from public.staff_tasks where active;
  if task_id is null then raise exception 'Staff phone test needs one active task fixture'; end if;
  perform set_config('staff_phone_test.worker_id', worker_id::text, true);
  perform set_config('staff_phone_test.task_id', task_id::text, true);
  perform set_config('staff_phone_test.device_id', device_id::text, true);
  perform set_config('staff_phone_test.code', pairing_code, true);
end;
$$;

set local role anon;
select lives_ok($$select public.staff_phone(current_setting('staff_phone_test.code'), 'begin', current_setting('staff_phone_test.worker_id')::bigint, null, null, null, '00000000-0000-4000-8000-000000000001'::uuid, now() - interval '30 seconds')$$, 'a paired phone can start a shift');
select lives_ok($$select public.staff_phone(current_setting('staff_phone_test.code'), 'begin', current_setting('staff_phone_test.worker_id')::bigint, null, null, null, '00000000-0000-4000-8000-000000000001'::uuid, now() - interval '30 seconds')$$, 'retrying the same begin request is accepted');
select lives_ok($$select public.staff_phone(current_setting('staff_phone_test.code'), 'task', current_setting('staff_phone_test.task_id')::bigint, null, null, null, '00000000-0000-4000-8000-000000000002'::uuid, now() - interval '20 seconds')$$, 'a paired phone can record a task');
select lives_ok($$select public.staff_phone(current_setting('staff_phone_test.code'), 'task', current_setting('staff_phone_test.task_id')::bigint, null, null, null, '00000000-0000-4000-8000-000000000002'::uuid, now() - interval '20 seconds')$$, 'retrying the same task request is accepted');
reset role;

select is((select count(*)::int from public.staff_shifts where paired_device_id = current_setting('staff_phone_test.device_id')::uuid and ended_at is null), 1, 'replayed begin does not create a second shift');
select is((select count(*)::int from public.staff_entries e join public.staff_shifts s on s.id = e.shift_id where s.paired_device_id = current_setting('staff_phone_test.device_id')::uuid and e.ended_at is null), 1, 'retrying a task does not create a duplicate task entry');

select * from finish();
rollback;
