-- Stationery: 48-hour document-file retention.
-- Run once in Supabase SQL Editor AFTER printing-system.sql.
-- Keeps order, customer, price, quantity, payment and print history records.
-- Only the uploaded document object is removed after a successful print + 48 hours.

alter table public.orders
  add column if not exists printed_at timestamptz,
  add column if not exists file_deleted_at timestamptz;

create or replace function public.stationery_record_printed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'Printed' and old.status is distinct from new.status then
    new.printed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists stationery_set_printed_at on public.orders;
create trigger stationery_set_printed_at
before update of status on public.orders
for each row
execute function public.stationery_record_printed_at();

-- Permit the PDF and Word formats already accepted by the order form.
update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]
where id = 'print-jobs';

-- Note: file_path is intentionally retained until the cleanup job successfully
-- removes the object. The cleanup endpoint then nulls file_path and stamps file_deleted_at.
