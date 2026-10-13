-- VITAL ID clinician suggestions
-- Run this AFTER 001_vital_id.sql.

create table if not exists public.clinical_suggestions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  qr_slug text,
  kind text not null check (kind in ('condition','medication','allergy','lab','radiology','surgery','vaccination','note','document')),
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  payload jsonb not null default '{}'::jsonb,
  attachment jsonb,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists clinical_suggestions_owner_id_idx on public.clinical_suggestions(owner_id);
create index if not exists clinical_suggestions_patient_id_idx on public.clinical_suggestions(patient_id);
create index if not exists clinical_suggestions_status_idx on public.clinical_suggestions(status);
create index if not exists clinical_suggestions_created_at_idx on public.clinical_suggestions(created_at desc);

alter table public.clinical_suggestions enable row level security;
revoke all on table public.clinical_suggestions from anon, authenticated;
grant select, update, delete on table public.clinical_suggestions to authenticated;

drop policy if exists "owners select clinical suggestions" on public.clinical_suggestions;
create policy "owners select clinical suggestions" on public.clinical_suggestions
for select to authenticated
using ((select auth.uid()) = owner_id);

drop policy if exists "owners update clinical suggestions" on public.clinical_suggestions;
create policy "owners update clinical suggestions" on public.clinical_suggestions
for update to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists "owners delete clinical suggestions" on public.clinical_suggestions;
create policy "owners delete clinical suggestions" on public.clinical_suggestions
for delete to authenticated
using ((select auth.uid()) = owner_id);
