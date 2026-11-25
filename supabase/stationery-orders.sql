-- Stationery: order storage and safe public tracking
create extension if not exists pgcrypto;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  customer_name text not null,
  registration_number text,
  phone text not null,
  order_type text not null,
  details text,
  items jsonb not null default '[]'::jsonb,
  total_amount numeric(12,2) not null default 0,
  status text not null default 'Pending',
  created_at timestamptz not null default now()
);

alter table public.orders enable row level security;

drop policy if exists "Public can submit orders" on public.orders;
create policy "Public can submit orders"
on public.orders for insert
to anon, authenticated
with check (
  length(trim(customer_name)) between 2 and 120
  and length(trim(phone)) between 5 and 30
  and length(trim(reference)) between 8 and 30
  and status = 'Pending'
);

revoke all on public.orders from anon, authenticated;
grant insert (reference, customer_name, registration_number, phone, order_type, details, items, total_amount)
on public.orders to anon, authenticated;

create or replace function public.track_stationery_order(order_reference text)
returns table(status text, order_type text, created_at timestamptz)
language sql
security definer
set search_path = ''
as $$
  select o.status, o.order_type, o.created_at
  from public.orders o
  where upper(o.reference) = upper(trim(order_reference))
  limit 1;
$$;

revoke all on function public.track_stationery_order(text) from public;
grant execute on function public.track_stationery_order(text) to anon, authenticated;
