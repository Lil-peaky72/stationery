-- Run AFTER stationery-orders.sql in the Supabase SQL editor.
-- Create the administrator user first under Supabase Authentication > Users.
create table if not exists public.stationery_admins (user_id uuid primary key references auth.users(id) on delete cascade, active boolean not null default true, created_at timestamptz not null default now());
alter table public.stationery_admins enable row level security;
create or replace function public.is_stationery_admin() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.stationery_admins a where a.user_id=(select auth.uid()) and a.active=true);
$$;
revoke all on function public.is_stationery_admin() from public;
grant execute on function public.is_stationery_admin() to authenticated;
drop policy if exists "Admins can read own admin record" on public.stationery_admins;
create policy "Admins can read own admin record" on public.stationery_admins for select to authenticated using(user_id=(select auth.uid()));
alter table public.orders add column if not exists file_path text;
alter table public.orders add column if not exists file_name text;
alter table public.orders add column if not exists mime_type text;
alter table public.orders add column if not exists copies integer not null default 1;
alter table public.orders add column if not exists paper_size text not null default 'A4';
alter table public.orders add column if not exists colour_mode text not null default 'Black & white';
drop policy if exists "Stationery admins can read orders" on public.orders;
create policy "Stationery admins can read orders" on public.orders for select to authenticated using(public.is_stationery_admin());
drop policy if exists "Stationery admins can update orders" on public.orders;
create policy "Stationery admins can update orders" on public.orders for update to authenticated using(public.is_stationery_admin()) with check(public.is_stationery_admin());
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('print-jobs','print-jobs',false,20971520,array['application/pdf']) on conflict(id) do update set public=false,file_size_limit=20971520,allowed_mime_types=array['application/pdf'];
drop policy if exists "Students can upload print PDFs" on storage.objects;
create policy "Students can upload print PDFs" on storage.objects for insert to anon,authenticated with check(bucket_id='print-jobs' and lower(storage.extension(name))='pdf');
drop policy if exists "Admins can read print PDFs" on storage.objects;
create policy "Admins can read print PDFs" on storage.objects for select to authenticated using(bucket_id='print-jobs' and public.is_stationery_admin());
drop policy if exists "Admins can delete print PDFs" on storage.objects;
create policy "Admins can delete print PDFs" on storage.objects for delete to authenticated using(bucket_id='print-jobs' and public.is_stationery_admin());
-- After creating the admin user in Authentication > Users, run this separately:
-- insert into public.stationery_admins(user_id) select id from auth.users where email='ADMIN_EMAIL_HERE' on conflict(user_id) do update set active=true;


-- Allow anonymous student checkout to attach the PDF object path and file metadata.
grant insert (reference, customer_name, registration_number, phone, order_type, details, items, total_amount, file_path, file_name, mime_type)
on public.orders to anon, authenticated;
-- Authenticated users still see/update orders only when the RLS admin policy above allows it.
grant select, update (status, copies, paper_size, colour_mode)
on public.orders to authenticated;
