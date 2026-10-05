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
- Product catalogue with search and category filtering
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
