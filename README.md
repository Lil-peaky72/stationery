# Stationery

A student-focused printing and stationery storefront.

## Current stage

- Responsive storefront with printing, photocopying and binding services
- Stationery catalogue with category filters, search and a shopping bag
- Order form that saves orders to Supabase, with optional document upload (PDF or Word, up to 10 MB)
- Order tracking by reference number
- Student Document Studio (fixed UDOM cover page and A4 editor)
- Admin page at `/#admin` for staff to view orders, change their status and open uploaded documents

Not built yet: payments, stock management, and server-side price calculation. The product catalogue and prices are sample data, and the order total is currently calculated in the browser.

## Tech stack

- React + Vite
- Supabase (database, authentication, storage)
- CSS
- Lucide icons

## Run locally

1. Install Node.js (20.19+ or 22.12+ recommended by current Vite documentation).
2. Clone this repository.
3. Create a `.env.local` file with your Supabase project values:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-PUBLISHABLE-KEY
```

4. Run:

```bash
npm install
npm run dev
```

5. Open the local URL printed in the terminal (usually http://localhost:5173).

To check a production build:

```bash
npm run build
```

## Supabase setup

Run these files in the Supabase SQL editor, in order:

1. `supabase/stationery-orders.sql` — orders table, public order submission and safe public tracking.
2. `supabase/stationery-admin-and-uploads.sql` — document uploads (private storage bucket), admin allowlist, order status updates for admins.

Then create your admin account:

1. In Supabase, open Authentication and create a user with your email and a strong password.
2. Run this in the SQL editor, using your own email:

```sql
insert into public.stationery_admins (user_id)
select id from auth.users where email = 'YOU@EXAMPLE.COM'
on conflict do nothing;
```

3. Turn off public sign-ups in Authentication settings so nobody else can create accounts.
4. Open `/#admin` on the site and sign in.

Set the same two `VITE_` variables in your Vercel project settings for the deployed site.

## Planned roadmap

1. Confirm real products, prices, support details and collection/delivery options.
2. Calculate order totals on the server from a products table.
3. Add rate limiting or a captcha for public order submission.
4. Product, stock and sales management in the admin page.
5. Integrate an appropriate Tanzanian payment provider after business requirements are confirmed.
6. Test security, mobile usability, backups and deployment.

## Project structure

```
stationery/
├── index.html
├── src/
│   ├── App.jsx            storefront, order form, tracking
│   ├── AdminPanel.jsx     staff order management (/#admin)
│   ├── DocumentStudio.jsx student document workspace
│   ├── lib/supabase.js    Supabase client
│   ├── main.jsx
│   ├── admin.css
│   ├── document-studio.css
│   └── styles.css
├── supabase/
│   ├── stationery-orders.sql
│   └── stationery-admin-and-uploads.sql
├── .gitignore
├── package.json
└── README.md
```
