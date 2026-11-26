-- Stationery: make derickmwesiga44@gmail.com an admin
--
-- 1. In Supabase, open Authentication > Users > Add user, and create this email with a strong password.
-- 2. Run printing-system.sql first (it creates the admin table), then run this file in the SQL editor.
-- 3. Turn off public sign-ups in Authentication settings so nobody else can create an account.
--
-- Safe to run more than once. It stops with a clear message if the user does not exist yet.

do $$
declare
  admin_id uuid;
begin
  select id into admin_id
  from auth.users
  where lower(email) = lower('derickmwesiga44@gmail.com');

  if admin_id is null then
    raise exception 'No Supabase user with email derickmwesiga44@gmail.com yet. Create it under Authentication > Users first, then run this again.';
  end if;

  insert into public.stationery_admins (user_id, active)
  values (admin_id, true)
  on conflict (user_id) do update set active = true;
end $$;
