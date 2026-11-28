-- Stationery order push notifications.
-- Run once in Supabase SQL Editor. This creates an isolated table and does not
-- modify orders, pricing, printing, storage, authentication, or retention rules.

create table if not exists public.stationery_push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fid text not null unique,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists stationery_push_devices_user_id_idx
  on public.stationery_push_devices(user_id);

alter table public.stationery_push_devices enable row level security;

-- Device identifiers are written/read/deleted only by trusted Edge Functions
-- using the service role. Browser clients receive no direct table privileges.
revoke all on table public.stationery_push_devices from public, anon, authenticated;
grant all on table public.stationery_push_devices to service_role;
