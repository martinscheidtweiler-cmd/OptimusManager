-- Add private, administrator-only invoice content checks for veterinary visits.

-- Keep this migration self-contained: the manager admin helper is not present
-- in every existing database because older schema changes were applied out of band.
create or replace function public.optimus_is_manager_admin()
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.optimus_task_people p
    where p.user_id = (select auth.uid())
      and p.active is true
      and p.role = 'admin'
  );
$$;
revoke all on function public.optimus_is_manager_admin() from public, anon;
grant execute on function public.optimus_is_manager_admin() to authenticated;

create table if not exists public.optimus_vet_invoice_checks (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null unique references public.vet_visits(id) on delete cascade,
  horse_id uuid not null references public.horses(id),
  invoice_file_path text,
  invoice_file_name text,
  expected_items jsonb not null default '[]'::jsonb,
  review_notes text,
  review_status text not null default 'awaiting_invoice'
    check (review_status in ('awaiting_invoice','to_review','matched','discrepancy')),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists optimus_vet_invoice_checks_horse_updated
  on public.optimus_vet_invoice_checks(horse_id, updated_at desc);

alter table public.optimus_vet_invoice_checks enable row level security;
drop policy if exists optimus_vet_invoice_checks_admin_select on public.optimus_vet_invoice_checks;
drop policy if exists optimus_vet_invoice_checks_admin_insert on public.optimus_vet_invoice_checks;
drop policy if exists optimus_vet_invoice_checks_admin_update on public.optimus_vet_invoice_checks;
create policy optimus_vet_invoice_checks_admin_select on public.optimus_vet_invoice_checks
  for select to authenticated using ((select public.optimus_is_manager_admin()));
create policy optimus_vet_invoice_checks_admin_insert on public.optimus_vet_invoice_checks
  for insert to authenticated with check ((select public.optimus_is_manager_admin()));
create policy optimus_vet_invoice_checks_admin_update on public.optimus_vet_invoice_checks
  for update to authenticated using ((select public.optimus_is_manager_admin()))
  with check ((select public.optimus_is_manager_admin()));
revoke all on public.optimus_vet_invoice_checks from anon, authenticated;
grant select, insert, update on public.optimus_vet_invoice_checks to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('vet-invoices', 'vet-invoices', false, 15728640, array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists vet_invoices_admin_select on storage.objects;
drop policy if exists vet_invoices_admin_insert on storage.objects;
drop policy if exists vet_invoices_admin_update on storage.objects;
drop policy if exists vet_invoices_admin_delete on storage.objects;
create policy vet_invoices_admin_select on storage.objects
  for select to authenticated using (bucket_id = 'vet-invoices' and (select public.optimus_is_manager_admin()));
create policy vet_invoices_admin_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'vet-invoices' and (select public.optimus_is_manager_admin()));
create policy vet_invoices_admin_update on storage.objects
  for update to authenticated using (bucket_id = 'vet-invoices' and (select public.optimus_is_manager_admin()))
  with check (bucket_id = 'vet-invoices' and (select public.optimus_is_manager_admin()));
create policy vet_invoices_admin_delete on storage.objects
  for delete to authenticated using (bucket_id = 'vet-invoices' and (select public.optimus_is_manager_admin()));
