-- Stationery: price list, page counts and server-side pricing
-- Run AFTER stationery-orders.sql, printing-system.sql and printing-hardening.sql. Safe to run more than once.
--
-- Prices live in public.price_list. To change a price, edit it in Supabase (Table Editor > price_list > price)
-- or run, for example:  update public.price_list set price = 150 where key = 'print_bw';

-- 1. Price list ---------------------------------------------------------------------

create table if not exists public.price_list (
  key text primary key,
  label text not null,
  price integer not null check (price >= 0 and price <= 1000000),
  updated_at timestamptz not null default now()
);

insert into public.price_list (key, label, price) values
  ('print_bw',     'Printing, black & white (per page)', 100),
  ('print_colour', 'Printing, colour (per page)',        200),
  ('copy',         'Photocopying (per page)',            100),
  ('form_page',    'University form (per page)',         200),
  ('binding',      'Binding (per document)',             500)
on conflict (key) do nothing;  -- never overwrites prices you have already changed

alter table public.price_list enable row level security;
revoke all on public.price_list from anon, authenticated;
grant select on public.price_list to anon, authenticated;
grant update (price) on public.price_list to authenticated;

drop policy if exists "Anyone can read prices" on public.price_list;
create policy "Anyone can read prices"
on public.price_list for select
to anon, authenticated
using (true);

drop policy if exists "Admins can change prices" on public.price_list;
create policy "Admins can change prices"
on public.price_list for update
to authenticated
using ((select public.is_stationery_admin()))
with check ((select public.is_stationery_admin()));

-- 2. Order columns for the cost calculation -------------------------------------------

alter table public.orders add column if not exists pages integer;
alter table public.orders add column if not exists add_binding boolean not null default false;

grant insert (copies, paper_size, colour_mode, pages, add_binding) on public.orders to anon, authenticated;

-- "Copies" now also means "documents to bind" for binding orders, so allow up to 100.
alter table public.orders drop constraint if exists orders_print_options_check;
alter table public.orders add constraint orders_print_options_check
  check (
    copies between 1 and 100
    and paper_size in ('A4', 'A3', 'Letter', 'Legal')
    and colour_mode in ('Black & white', 'Colour')
  )
  not valid;

alter table public.orders drop constraint if exists orders_pages_check;
alter table public.orders add constraint orders_pages_check
  check (pages is null or pages between 1 and 2000)
  not valid;

-- 3. The database works out the total, so a customer cannot change what they are charged ---
-- Printing, photocopying, university forms and binding are priced here from price_list.
-- Stationery purchases keep the total sent with the order (the shop bag).

create or replace function public.orders_apply_pricing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  p_bw int; p_colour int; p_copy int; p_form int; p_binding int;
  n_copies int;
  n_pages int;
  rate int;
  amount numeric;
begin
  -- Older versions of the website sent the service card title as the order type.
  if new.order_type = 'Document printing' then
    new.order_type := 'Printing';
  end if;

  if new.order_type not in ('Printing', 'Photocopying', 'University form', 'Binding & finishing') then
    return new;
  end if;

  select
    coalesce(max(price) filter (where key = 'print_bw'), 100),
    coalesce(max(price) filter (where key = 'print_colour'), 200),
    coalesce(max(price) filter (where key = 'copy'), 100),
    coalesce(max(price) filter (where key = 'form_page'), 200),
    coalesce(max(price) filter (where key = 'binding'), 500)
  into p_bw, p_colour, p_copy, p_form, p_binding
  from public.price_list;

  n_copies := greatest(1, least(coalesce(new.copies, 1), 100));
  n_pages := coalesce(new.pages, 0);

  if new.order_type = 'Binding & finishing' then
    amount := n_copies * p_binding;
  else
    if n_pages < 1 then
      return new;  -- no page count sent (older website): keep the submitted total
    end if;
    rate := case new.order_type
      when 'Printing' then case when new.colour_mode = 'Colour' then p_colour else p_bw end
      when 'Photocopying' then p_copy
      else p_form
    end;
    amount := n_pages::numeric * n_copies * rate;
    if new.add_binding then
      amount := amount + n_copies * p_binding;
    end if;
  end if;

  new.total_amount := amount;
  return new;
end;
$$;

revoke all on function public.orders_apply_pricing() from public, anon, authenticated;

drop trigger if exists orders_apply_pricing on public.orders;
create trigger orders_apply_pricing
before insert on public.orders
for each row execute function public.orders_apply_pricing();

-- 4. Faster sales reports by date ----------------------------------------------------------

create index if not exists orders_created_at_idx on public.orders (created_at desc);
