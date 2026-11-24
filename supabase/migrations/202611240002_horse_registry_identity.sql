-- Add official registry identity alongside existing stable names.
-- Existing horse ids and all care/history relations remain untouched.
alter table public.horses
  add column if not exists horse_number text,
  add column if not exists registered_name text,
  add column if not exists ueln text,
  add column if not exists microchip text,
  add column if not exists registered_sex text,
  add column if not exists food_chain_status text,
  add column if not exists identification_status text;

-- Preserve numbers already embedded in the legacy display name.
update public.horses
set horse_number = substring(name from '^([0-9]{1,4})(?:[[:space:]]|$)')
where horse_number is null
  and name ~ '^[0-9]{1,4}([[:space:]]|$)';

comment on column public.horses.horse_number is 'Stable or legacy horse number; separate from the display name.';
comment on column public.horses.registered_name is 'Official HorseID/passport registered name.';
comment on column public.horses.ueln is 'Universal Equine Life Number.';
comment on column public.horses.microchip is 'Microchip number from the official identification record.';
comment on column public.horses.registered_sex is 'Sex as shown on the official identification record.';
comment on column public.horses.food_chain_status is 'Food-chain status from the official identification record.';
comment on column public.horses.identification_status is 'Identification document status from HorseID.';
