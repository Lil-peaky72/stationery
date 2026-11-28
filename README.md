# Stationery

A student-focused printing and stationery storefront.

## What it does

- Storefront with printing, photocopying and binding services, a stationery catalogue and a shopping bag
- Order form that saves orders to Supabase, with a live cost estimate. Customers attach a PDF or Word file (.docx/.doc). The page count is read from the PDF or .docx
- Order tracking by reference number
- Student Document Studio (fixed UDOM cover page and A4 editor)
- Admin page at `/admin`: sign in, see every order, change its status, open uploaded PDF/Word files, and send PDFs to a printer through the Windows print agent (Word files are printed by hand, then marked Printed)
- Sales analytics in the admin page: sales per day or month, by service and by status, for any date range, plus an Excel (.xlsx) download of the same data

Not built yet: payments and stock management. The stationery catalogue and its prices are sample data, and a stationery purchase total still comes from the shopping bag in the browser. Printing, photocopying, university form and binding totals are calculated by the database.

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
4. `supabase/pricing-and-analytics.sql` — price list, page counts, and server-side totals
5. `supabase/word-documents.sql` — lets customers upload Word (.docx/.doc) as well as PDF

Then create the first admin:

1. In Supabase, open Authentication > Users and create the admin user (email and a strong password).
2. Run `supabase/seed-admin.sql` (it makes `derickmwesiga44@gmail.com` an admin and stops with a clear message if that user does not exist yet).
3. Turn off public sign-ups in Authentication settings.
4. Open `/admin` and sign in.

Run the files in the same order whenever you set up a new Supabase project.

## Prices

| Service | Price |
|---|---|
| Printing, black & white | TZS 100 per page |
| Printing, colour | TZS 200 per page |
| Photocopying | TZS 100 per page |
| University forms | TZS 200 per page |
| Binding | TZS 500 per document |

Cost = pages × copies × the page price, plus TZS 500 for each document when binding is added. For a binding-only order, the number of documents is the "copies" value.

The prices are stored in the `price_list` table and the database recalculates every order's total when it is saved, so customers cannot change what they are charged. To change a price, edit it in Supabase (Table Editor > `price_list`), or run for example `update public.price_list set price = 150 where key = 'print_bw';`. The website shows the new price straight away. Stationery purchases keep the total from the shopping bag.

## Sales analytics and Excel

Open `/admin` and choose the Sales analytics tab. Pick a quick period or any From and To dates (Dar es Salaam time). "Sales" count every order except Cancelled and Failed, including orders still pending. Download Excel gives a workbook with four sheets: Summary, Orders (one row per order with filters, ready for pivot tables), Daily (or Monthly for long periods) and the service breakdown inside Summary.

## Phone order notifications

Optional Android Chrome push alerts can be added without changing checkout or printing. See [the setup guide](docs/order-push-notifications.md) for Firebase, Supabase Edge Function, and webhook configuration.

## Printing from the admin page

See `windows-print-agent/README.md` for the one-time setup on the shop's Windows computer.

## Roadmap

1. Confirm real products, prices, support details and collection/delivery options
2. Calculate stationery purchase totals on the server from a products table
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
│   ├── AdminAnalytics.jsx   sales analytics tab
│   ├── DocumentStudio.jsx   student document workspace
│   ├── lib/
│   │   ├── supabase.js      Supabase client
│   │   ├── pricing.js       price rules and cost breakdown
│   │   ├── documents.js     PDF/Word file rules and page counting
│   │   ├── analytics.js     date ranges and sales summaries
│   │   └── exportExcel.js   builds the .xlsx report
│   └── main.jsx
├── supabase/
│   ├── stationery-orders.sql
│   ├── printing-system.sql
│   ├── printing-hardening.sql
│   ├── pricing-and-analytics.sql
│   ├── word-documents.sql
│   └── seed-admin.sql
└── windows-print-agent/     local service that sends PDFs to Windows printers
```
