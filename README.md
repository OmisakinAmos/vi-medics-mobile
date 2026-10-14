# Vi-Medics

**Medical Equipment. Trusted Care.**

Vi-Medics is a medical device and equipment e-commerce application being built for HNG15 Lesson 2. The project demonstrates a complete product journey rather than a static AI-generated website.

## Current status — Phase 1 complete, Phase 2 (Supabase) prepared

Phase 2 adds the database design and a data layer. Nothing is live until you create a Supabase project:

1. Create a project at supabase.com.
2. In the SQL Editor run `supabase/schema.sql`, then `supabase/seed.sql`.
3. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Project Settings -> API; use the anon/public key only).
4. Restart `npm run dev`. With no `.env`, the app keeps using the mock catalogue.

The schema covers `profiles`, `products`, `orders` and `order_items` with Row Level Security (public read of active products, users read only their own orders). Orders are created only through the `place_order()` database function, which checks stock, decrements it and takes prices from the database. Checkout is not yet wired to it; that is Phase 4.

### Code layout

`src/types` types, `src/data` mock catalogue, `src/lib` Supabase client and formatting, `src/services` data access, `src/components` shared UI, `src/pages` screens, `src/App.tsx` routing and cart state.

## Phase 1 features

The first frontend milestone:

- Responsive global navigation
- Homepage hero, trust section, categories and featured products
- Product catalogue with search and category filtering (Monitoring, Diagnostic, Mobility, Respiratory, Wound Care, Medical Consumables)
- `/services` page for the biomedical engineering service (equipment maintenance and servicing), handled by phone/WhatsApp enquiry rather than the cart
- About page describing equipment, medical consumables and servicing
- Product detail pages
- Shopping cart with quantity controls
- Checkout UI
- Google sign-in placeholder UI
- Account/order history placeholder UI
- Order confirmation UI
- Responsive desktop/tablet/mobile styling

No external integrations are connected yet. Supabase, Google OAuth and Mailgun are intentionally reserved for later phases.

## MVP

- Product catalogue
- Product search/filtering
- Product details
- Stock availability
- Shopping cart
- Checkout
- Google authentication
- Persistent orders with Supabase
- Order history
- Mailgun confirmation email
- Production deployment

## Stack

React + Vite + TypeScript + CSS (Phase 1) + Supabase + Google OAuth + Mailgun + Vercel.

## UX principle

**Browse -> View -> Add to Cart -> Checkout -> Place Order -> Confirmation -> View Orders**

## Run locally

```bash
npm install
npm run dev
```

## Development phases

1. Static UI — current phase
2. Supabase database
3. Google authentication
4. Checkout and order persistence
5. Mailgun confirmation email
6. Deployment
7. End-to-end testing with Playwright + TypeScript

## Security

Never commit `.env` files, API secrets or private credentials. Use environment variables for all external-service configuration.

## SEO (marketing)

- **Real URLs**: `/products`, `/product/vm-001`, … (no `#/`). Old `#/…` links are upgraded automatically. `vercel.json` sends unknown paths to the app.
- **Crawlable links**: navigation uses real `<a href>` via `src/components/Link.tsx`.
- **Per-page meta**: `src/lib/seo.ts` (`useSeo`) sets title, description, canonical, Open Graph/Twitter tags and JSON-LD (Product, BreadcrumbList). Cart, checkout, login, account and confirmation are `noindex`.
- **Sitemap/robots**: `/sitemap.xml` is generated live from Supabase by `api/sitemap.ts`; `public/robots.txt` blocks private pages.
- **Domain**: set `VITE_SITE_URL` (and `SITE_URL` for the sitemap function), and update the URLs in `index.html` and `public/robots.txt`, when a custom domain is added.
- **Known limit**: pages are rendered in the browser. Google runs JavaScript so it indexes them, but WhatsApp/LinkedIn link previews for individual products show the site-wide card. Prerendering product pages would fix that.
- **After deploy**: add the site in Google Search Console and submit `https://vi-medics.vercel.app/sitemap.xml`.

## Categories and the Medical Consumables migration
Product categories are enforced by a check constraint in Supabase. After adding `Medical Consumables`, run `supabase/migrations/002-medical-consumables.sql` once in the Supabase SQL Editor (it updates the constraint and adds sample disposable products; prices and stock there are placeholders to edit). New installs using `supabase/setup.sql` already include it.

## Admin area (/admin)
Admins manage products (including descriptions and photo upload), view customers and orders, and update order status. Access is decided by the database: `supabase/migrations/003-admin.sql` creates a locked `admins` table, an `is_admin()` function and admin-only RLS policies, and makes the store owner's email an admin. To add another admin, insert their auth user id into `public.admins` in the SQL Editor. The page is `noindex`, disallowed in `robots.txt`, and only shown in My Account for admins.

## Payments, receipts, reports and audit trail
- Customers pay by **bank transfer** only. Checkout saves the order (pending, awaiting payment, stock reserved) and shows the bank details; **I have paid** records the report and emails a branded receipt (`api/send-receipt.ts`). The receipt is also shown on screen and can be printed or saved as PDF.
- Bank details are stored in the `store_settings` table and edited in **Admin -> Payment settings**. They are never hard-coded.
- Admin can **Confirm payment** and **Mark delivered** on each order. Cancelling an order returns its stock.
- **Reports** (Admin -> Reports): orders, money received, awaiting payment, delivered, average order, new customers, best sellers, stock to watch, CSV download.
- **Audit trail** (Admin -> Audit trail): who did what and when (orders, payments, deliveries, product and payment-setting changes, new accounts, sign-ins). Written by database triggers; admins can read it but nobody can edit or delete entries from the app.
- Setup: run `supabase/migrations/006-payments-reports-audit.sql` once. Optional env var `ORDER_NOTIFY_EMAIL` sends a BCC of every receipt to the store.


## Roadmap
- **Accounting and expenses module** (built; needs `008-accounting.sql`): admin Accounting tab with sales, cost of goods, profit, expenses, and analysis by period, product and location.
- **Google Business Profile** (planned): local search visibility. Phone and contact details will be reviewed first.

## Security
See `SECURITY.md`. Run `supabase/migrations/007-security-and-delivery.sql` after 006. Delivery fee is no longer added to totals; delivery is arranged outside the app. Navigation (Home, Shop, Servicing, Cart, Account) is a top bar after the logo.

## Accounting
Admin -> Accounting. Run `supabase/migrations/008-accounting.sql` after 007. Sales count when a payment is confirmed (cancelled orders never count). Cost prices are stored in the admin-only `product_costs` table (never on the public products table) and snapshotted per sold item in `order_item_costs`. Profit = sales - cost of goods - marketing/other costs; stock purchases are shown separately so they are not counted twice. Pure maths lives in `src/lib/accounting.ts`.
