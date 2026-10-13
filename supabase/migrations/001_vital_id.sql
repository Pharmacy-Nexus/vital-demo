-- VITAL ID cloud prototype schema
-- Run this in Supabase SQL Editor before enabling cloud sync.

create extension if not exists pgcrypto;

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  slug text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, slug)
);

create index if not exists patients_owner_id_idx on public.patients(owner_id);

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  client_id text not null,
  qr_slug text not null unique,
  status text not null default 'active' check (status in ('active','deactivated')),
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, client_id)
);

create index if not exists devices_owner_id_idx on public.devices(owner_id);
create index if not exists devices_patient_id_idx on public.devices(patient_id);
create index if not exists devices_qr_slug_idx on public.devices(qr_slug);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete cascade,
  device_id uuid references public.devices(id) on delete set null,
  type text not null check (type in ('scan','access','update')),
  title text not null,
  detail text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_owner_id_idx on public.activity_logs(owner_id);
create index if not exists activity_logs_patient_id_idx on public.activity_logs(patient_id);
create index if not exists activity_logs_created_at_idx on public.activity_logs(created_at desc);

create or replace function public.set_vital_id_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists patients_updated_at on public.patients;
create trigger patients_updated_at before update on public.patients
for each row execute function public.set_vital_id_updated_at();

drop trigger if exists devices_updated_at on public.devices;
create trigger devices_updated_at before update on public.devices
for each row execute function public.set_vital_id_updated_at();

-- Lock tables down. Public QR reads are performed only by server routes with the service role.
alter table public.patients enable row level security;
alter table public.devices enable row level security;
alter table public.activity_logs enable row level security;

revoke all on table public.patients from anon, authenticated;
revoke all on table public.devices from anon, authenticated;
revoke all on table public.activity_logs from anon, authenticated;

grant select, insert, update, delete on table public.patients to authenticated;
grant select, insert, update, delete on table public.devices to authenticated;
grant select, insert, update, delete on table public.activity_logs to authenticated;

drop policy if exists "owners select patients" on public.patients;
create policy "owners select patients" on public.patients for select to authenticated
using ((select auth.uid()) = owner_id);

drop policy if exists "owners insert patients" on public.patients;
create policy "owners insert patients" on public.patients for insert to authenticated
with check ((select auth.uid()) = owner_id);

drop policy if exists "owners update patients" on public.patients;
create policy "owners update patients" on public.patients for update to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists "owners delete patients" on public.patients;
create policy "owners delete patients" on public.patients for delete to authenticated
using ((select auth.uid()) = owner_id);

drop policy if exists "owners select devices" on public.devices;
create policy "owners select devices" on public.devices for select to authenticated
using ((select auth.uid()) = owner_id);

drop policy if exists "owners insert devices" on public.devices;
create policy "owners insert devices" on public.devices for insert to authenticated
with check ((select auth.uid()) = owner_id);

drop policy if exists "owners update devices" on public.devices;
create policy "owners update devices" on public.devices for update to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists "owners delete devices" on public.devices;
create policy "owners delete devices" on public.devices for delete to authenticated
using ((select auth.uid()) = owner_id);

drop policy if exists "owners select activity" on public.activity_logs;
create policy "owners select activity" on public.activity_logs for select to authenticated
using ((select auth.uid()) = owner_id);

drop policy if exists "owners insert activity" on public.activity_logs;
create policy "owners insert activity" on public.activity_logs for insert to authenticated
with check ((select auth.uid()) = owner_id);

-- Private medical document bucket.
insert into storage.buckets (id, name, public)
values ('medical-documents', 'medical-documents', false)
on conflict (id) do update set public = false;

-- A user can only manage files in a top-level folder named with their auth user id.
drop policy if exists "owners upload medical documents" on storage.objects;
create policy "owners upload medical documents" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'medical-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "owners read medical documents" on storage.objects;
create policy "owners read medical documents" on storage.objects
for select to authenticated
using (
  bucket_id = 'medical-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "owners update medical documents" on storage.objects;
create policy "owners update medical documents" on storage.objects
for update to authenticated
using (
  bucket_id = 'medical-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'medical-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "owners delete medical documents" on storage.objects;
create policy "owners delete medical documents" on storage.objects
for delete to authenticated
using (
  bucket_id = 'medical-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
