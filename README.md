# Stationery

A student-focused printing and stationery storefront.

## Current stage: Phase 1 — Frontend prototype

The current frontend includes:
- Responsive landing page and navigation
- Printing, photocopying and binding service cards
- Stationery catalogue with category filters and search
- Shopping bag with quantity controls and estimated total
- Print request form preview
- Order tracking interface placeholder
- Student-friendly support section

**Important:** This is a frontend prototype. Orders, uploaded files, authentication, live tracking, stock, and payments are not connected to a backend yet. The product catalogue and prices are sample data.

## Tech stack

- React
- Vite
- CSS
- Lucide icons

## Run locally

1. Install Node.js (20.19+ or 22.12+ recommended by current Vite documentation).
2. Clone this repository.
3. Open the project folder in a terminal.
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

## Planned roadmap

1. **Frontend:** Refine the storefront and confirm real products, prices, support details and collection/delivery options.
2. **Backend:** Add Supabase database, authentication and secure document storage.
3. **Orders:** Persist orders and implement real order status tracking.
4. **Admin:** Add protected order, product, stock and sales management.
5. **Payments:** Integrate an appropriate Tanzanian payment provider after business requirements are confirmed.
6. **Launch:** Test security, mobile usability, backups and deployment.

## Project structure

```
stationery/
├── index.html
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   └── styles.css
├── .gitignore
├── package.json
└── README.md
```
