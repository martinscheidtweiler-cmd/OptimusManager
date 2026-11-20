-- Additive schema for Optimus Stable Manager. Review on a staging database first.
create extension if not exists pgcrypto;
create table if not exists public.optimus_care_events (
 id uuid primary key default gen_random_uuid(),
 horse_id uuid not null references public.horses(id),
 category text not null check(category in ('scan','insemination','pregnancy','foaling','flush','vaccination','deworming','farrier','veterinary','other')),
 performed_on date not null default current_date,
 result text,
 notes text,
 next_due_on date,
 veterinarian text,
 medication_name text,
 medication_quantity numeric,
 created_by uuid not null default auth.uid(),
 created_at timestamptz not null default now()
);
create index if not exists optimus_care_events_horse_date on public.optimus_care_events(horse_id,performed_on desc);
create table if not exists public.optimus_medication_stock (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 lot_number text,
 expires_on date,
 quantity numeric not null default 0 check(quantity>=0),
 unit text not null default 'stuks',
 minimum_quantity numeric not null default 0 check(minimum_quantity>=0),
 notes text,
 updated_at timestamptz not null default now()
);
create table if not exists public.optimus_medication_movements (
 id uuid primary key default gen_random_uuid(),
 stock_id uuid not null references public.optimus_medication_stock(id),
 horse_id uuid references public.horses(id),
 care_event_id uuid references public.optimus_care_events(id),
 delta numeric not null check(delta<>0),
 reason text not null,
 authorized_by text,
 performed_by uuid not null default auth.uid(),
 created_at timestamptz not null default now()
);
create table if not exists public.optimus_vet_cases (
 id uuid primary key default gen_random_uuid(),
 horse_id uuid not null references public.horses(id),
 title text not null,
 status text not null default 'open' check(status in ('open','monitoring','closed')),
 veterinarian text,
 diagnosis text,
 treatment_plan text,
 next_check_on date,
 opened_at timestamptz not null default now(),
 created_by uuid not null default auth.uid()
);
create table if not exists public.optimus_horseid_outbox (
 id uuid primary key default gen_random_uuid(),
 movement_key text not null unique,
 horse_id uuid not null references public.horses(id),
 horse_name text not null,
 chip_number text,
 from_establishment text,
 to_establishment text,
 from_site_id uuid references public.sites(id),
 to_site_id uuid references public.sites(id),
 from_site_name text not null,
 to_site_name text not null,
 movement_at timestamptz not null,
 status text not null default 'draft' check(status in ('draft','approved','sent','cancelled')),
 created_by uuid not null default auth.uid(),
 created_at timestamptz not null default now()
);
create index if not exists optimus_horseid_outbox_review on public.optimus_horseid_outbox(status,created_at desc);
-- Fail-closed: RLS is enabled, but no policies are created until the existing
-- Optimus roles and user mapping are verified on a staging database.
-- Do not expose clinical records to every authenticated user.
do $$ declare t text; begin
 foreach t in array array['optimus_care_events','optimus_medication_stock','optimus_medication_movements','optimus_vet_cases','optimus_horseid_outbox'] loop
  execute format('alter table public.%I enable row level security',t);
 end loop;
end $$;
-- No automatic email sending or direct HorseID mutation.
