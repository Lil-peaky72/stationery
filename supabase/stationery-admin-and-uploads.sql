-- Stationery: document uploads, admin allowlist and order status management
-- Run this AFTER stationery-orders.sql. It is safe to run more than once.

-- 1. Orders: uploaded document path and valid statuses -------------------------

alter table public.orders add column if not exists document_path text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_status_check') then
    alter table public.orders add constraint orders_status_check
      check (status in ('Pending', 'Received', 'Printing', 'Ready for collection', 'Completed', 'Cancelled'));
  end if;

  -- Only accept the random file names the website generates, so a customer
  -- cannot point an order at some other file in storage.
  if not exists (select 1 from pg_constraint where conname = 'orders_document_path_check') then
    alter table public.orders add constraint orders_document_path_check
      check (
        document_path is null
        or document_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|doc|docx)$'
      );
  end if;
end $$;

grant insert (document_path) on public.orders to anon, authenticated;

-- 2. Admin allowlist ----------------------------------------------------------
-- Only users listed here can manage orders. The table has RLS on and no
-- policies, so it cannot be read or changed through the public API.

create table if not exists public.stationery_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.stationery_admins enable row level security;
revoke all on public.stationery_admins from anon, authenticated;

create or replace function public.is_stationery_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.stationery_admins a
    where a.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_stationery_admin() from public, anon;
grant execute on function public.is_stationery_admin() to authenticated;

-- 3. Orders: admins can read orders and change their status -------------------

grant select on public.orders to authenticated;
grant update (status) on public.orders to authenticated;

drop policy if exists "Admins can read orders" on public.orders;
create policy "Admins can read orders"
on public.orders for select
to authenticated
using ((select public.is_stationery_admin()));

drop policy if exists "Admins can update order status" on public.orders;
create policy "Admins can update order status"
on public.orders for update
to authenticated
using ((select public.is_stationery_admin()))
with check ((select public.is_stationery_admin()));

-- Speeds up the admin list, which shows newest orders first.
create index if not exists orders_created_at_idx on public.orders (created_at desc);

-- 4. Private storage bucket for uploaded documents ----------------------------
-- Anyone can upload (PDF or Word, up to 10 MB). Only admins can read files.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'order-documents',
  'order-documents',
  false,
  10485760,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can upload order documents" on storage.objects;
create policy "Public can upload order documents"
on storage.objects for insert
to anon, authenticated
with check (bucket_id = 'order-documents');

drop policy if exists "Admins can read order documents" on storage.objects;
create policy "Admins can read order documents"
on storage.objects for select
to authenticated
using (bucket_id = 'order-documents' and (select public.is_stationery_admin()));

-- 5. Make yourself an admin ---------------------------------------------------
-- First create your user in Supabase (Authentication > Users), then run this
-- with your own email:
--
-- insert into public.stationery_admins (user_id)
-- select id from auth.users where email = 'YOU@EXAMPLE.COM'
-- on conflict do nothing;
