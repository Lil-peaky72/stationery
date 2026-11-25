-- Stationery: hardening for the printing system
-- Run AFTER stationery-orders.sql and printing-system.sql. Safe to run more than once.
-- Constraints are added NOT VALID so any test orders already in the table are left alone;
-- they apply to every new order and every update from now on.

-- 1. Admin check: signed-out visitors must not be able to call it ------------------

revoke all on function public.is_stationery_admin() from public, anon;
grant execute on function public.is_stationery_admin() to authenticated;

-- 2. Admin allowlist: readable by the signed-in admin only, never writable by the API --

revoke all on public.stationery_admins from anon, authenticated;
grant select on public.stationery_admins to authenticated;

-- 3. Order constraints --------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_status_check') then
    alter table public.orders add constraint orders_status_check
      check (status in ('Pending', 'Printing', 'Printed', 'Failed', 'Ready for collection', 'Completed', 'Cancelled'))
      not valid;
  end if;

  -- A PDF path must be "<order reference>/<safe file name>.pdf" so an order can only
  -- point at its own upload.
  if not exists (select 1 from pg_constraint where conname = 'orders_file_path_check') then
    alter table public.orders add constraint orders_file_path_check
      check (
        file_path is null
        or (
          file_path ~ '^STN-[0-9A-F]{10}/[A-Za-z0-9._-]{1,150}\.[Pp][Dd][Ff]$'
          and file_path like reference || '/%'
        )
      )
      not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'orders_file_meta_check') then
    alter table public.orders add constraint orders_file_meta_check
      check (
        (file_name is null or length(file_name) <= 200)
        and (mime_type is null or mime_type = 'application/pdf')
      )
      not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'orders_print_options_check') then
    alter table public.orders add constraint orders_print_options_check
      check (
        copies between 1 and 20
        and paper_size in ('A4', 'A3', 'Letter', 'Legal')
        and colour_mode in ('Black & white', 'Colour')
      )
      not valid;
  end if;
end $$;

-- Students choose copies, paper size and colour on the order form.
grant insert (copies, paper_size, colour_mode) on public.orders to anon, authenticated;

create index if not exists orders_status_created_idx on public.orders (status, created_at desc);

-- 4. Admin policies: evaluate the admin check once per query, not once per row --------

drop policy if exists "Stationery admins can read orders" on public.orders;
create policy "Stationery admins can read orders"
on public.orders for select
to authenticated
using ((select public.is_stationery_admin()));

drop policy if exists "Stationery admins can update orders" on public.orders;
create policy "Stationery admins can update orders"
on public.orders for update
to authenticated
using ((select public.is_stationery_admin()))
with check ((select public.is_stationery_admin()));

-- 5. Print-job storage: uploads must follow the same naming rule -----------------------

drop policy if exists "Students can upload print PDFs" on storage.objects;
create policy "Students can upload print PDFs"
on storage.objects for insert
to anon, authenticated
with check (
  bucket_id = 'print-jobs'
  and name ~ '^STN-[0-9A-F]{10}/[A-Za-z0-9._-]{1,150}\.[Pp][Dd][Ff]$'
);

drop policy if exists "Admins can read print PDFs" on storage.objects;
create policy "Admins can read print PDFs"
on storage.objects for select
to authenticated
using (bucket_id = 'print-jobs' and (select public.is_stationery_admin()));

drop policy if exists "Admins can delete print PDFs" on storage.objects;
create policy "Admins can delete print PDFs"
on storage.objects for delete
to authenticated
using (bucket_id = 'print-jobs' and (select public.is_stationery_admin()));
