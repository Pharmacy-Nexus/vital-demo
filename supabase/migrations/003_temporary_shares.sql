-- VITAL ID temporary medical record sharing
-- Run AFTER 001_vital_id.sql and 002_clinical_suggestions.sql.

create table if not exists public.share_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  token text not null unique,
  scope text not null check (scope in ('emergency','summary','full')),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists share_links_owner_id_idx on public.share_links(owner_id);
create index if not exists share_links_patient_id_idx on public.share_links(patient_id);
create index if not exists share_links_token_idx on public.share_links(token);
create index if not exists share_links_expires_at_idx on public.share_links(expires_at);

alter table public.share_links enable row level security;
revoke all on table public.share_links from anon, authenticated;
grant select, insert, update, delete on table public.share_links to authenticated;

drop policy if exists "owners select share links" on public.share_links;
create policy "owners select share links" on public.share_links
for select to authenticated
using ((select auth.uid()) = owner_id);

drop policy if exists "owners insert share links" on public.share_links;
create policy "owners insert share links" on public.share_links
for insert to authenticated
with check ((select auth.uid()) = owner_id);

drop policy if exists "owners update share links" on public.share_links;
create policy "owners update share links" on public.share_links
for update to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists "owners delete share links" on public.share_links;
create policy "owners delete share links" on public.share_links
for delete to authenticated
using ((select auth.uid()) = owner_id);
