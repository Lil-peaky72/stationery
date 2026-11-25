# Stationery

A student-focused printing and stationery storefront.

## What it does

- Storefront with printing, photocopying and binding services, a stationery catalogue and a shopping bag
- Order form that saves orders to Supabase. Printing orders include a PDF upload plus copies, paper size and colour
- Order tracking by reference number
- Student Document Studio (fixed UDOM cover page and A4 editor)
- Admin page at `/admin`: sign in, see every order, change its status, view uploaded PDFs and send them to a printer through the Windows print agent

Not built yet: payments, stock management and server-side price calculation. The catalogue and prices are sample data, and the order total is currently calculated in the browser.

## Tech stack

- React + Vite
- Supabase (database, authentication, private file storage)
- A small local Node service for printing (`windows-print-agent/`)

## Run locally

1. Install Node.js (20.19+ or 22.12+).
2. Create `.env.local` with your Supabase project values:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-PUBLISHABLE-KEY
```

3. Run `npm install` then `npm run dev`, and open http://localhost:5173.

Set the same two variables in your Vercel project settings for the deployed site. `vercel.json` makes `/admin` work when opened directly.

## Supabase setup

Run these files in the Supabase SQL editor, in this order:

1. `supabase/stationery-orders.sql` — orders table, public order submission, safe public tracking
2. `supabase/printing-system.sql` — admin allowlist, PDF storage bucket, print columns and admin policies
3. `supabase/printing-hardening.sql` — stricter checks on statuses, file paths and print options, and tighter permissions

Then create the first admin:

1. In Supabase, open Authentication > Users and create the admin user (email and a strong password).
2. Run `supabase/seed-admin.sql` (it makes `derickmwesiga44@gmail.com` an admin and stops with a clear message if that user does not exist yet).
3. Turn off public sign-ups in Authentication settings.
4. Open `/admin` and sign in.

Run the files in the same order whenever you set up a new Supabase project.

## Printing from the admin page

See `windows-print-agent/README.md` for the one-time setup on the shop's Windows computer.

## Roadmap

1. Confirm real products, prices, support details and collection/delivery options
2. Calculate order totals on the server from a products table
3. Add rate limiting or a captcha for public order submission
4. Product, stock and sales management in the admin page
5. Integrate an appropriate Tanzanian payment provider after business requirements are confirmed
6. Test security, mobile usability, backups and deployment

## Project structure

```
stationery/
├── index.html
├── vercel.json              lets /admin open directly
├── src/
│   ├── App.jsx              storefront, order form, tracking
│   ├── Admin.jsx            admin orders and printing (/admin)
│   ├── DocumentStudio.jsx   student document workspace
│   ├── lib/supabase.js      Supabase client
│   └── main.jsx
├── supabase/
│   ├── stationery-orders.sql
│   ├── printing-system.sql
│   ├── printing-hardening.sql
│   └── seed-admin.sql
└── windows-print-agent/     local service that sends PDFs to Windows printers
```
