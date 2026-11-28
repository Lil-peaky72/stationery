-- Word (.docx / .doc) uploads in addition to PDF.
-- Run AFTER pricing-and-analytics.sql. Safe to run more than once.
-- Existing PDF orders and uploads keep working exactly as before.

-- 1. Bucket: allow the three document types (still private, still 20 MB) ---------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'print-jobs', 'print-jobs', false, 20971520,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
set allowed_mime_types = excluded.allowed_mime_types,
    file_size_limit = excluded.file_size_limit,
    public = false;

-- 2. Storage upload rule: "<order reference>/<safe name>.pdf|doc|docx" ------------------
drop policy if exists "Students can upload print PDFs" on storage.objects;
create policy "Students can upload print PDFs"
on storage.objects for insert
to anon, authenticated
with check (
  bucket_id = 'print-jobs'
  and name ~ '^STN-[0-9A-F]{10}/[A-Za-z0-9._-]{1,150}\.([Pp][Dd][Ff]|[Dd][Oo][Cc][Xx]?)$'
);

-- 3. Orders: the file path and type checks accept the same three types ------------------
alter table public.orders drop constraint if exists orders_file_path_check;
alter table public.orders add constraint orders_file_path_check
  check (
    file_path is null
    or (
      file_path ~ '^STN-[0-9A-F]{10}/[A-Za-z0-9._-]{1,150}\.([Pp][Dd][Ff]|[Dd][Oo][Cc][Xx]?)$'
      and file_path like reference || '/%'
    )
  )
  not valid;

alter table public.orders drop constraint if exists orders_file_meta_check;
alter table public.orders add constraint orders_file_meta_check
  check (
    (file_name is null or length(file_name) <= 200)
    and (
      mime_type is null
      or mime_type in (
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )
    )
  )
  not valid;
