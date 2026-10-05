# Vi-Medics AI Coding Context

## Product
Vi-Medics is a professional e-commerce website for selling medical devices and equipment. The MVP is focused on browsing products, viewing product details, checking stock, adding items to a cart, checkout, Google authentication, persistent orders and confirmation emails.

## Primary user journey
Home -> Products -> Product Details -> Cart -> Checkout -> Authentication -> Place Order -> Persist Order -> Confirmation Email -> Order Confirmation -> My Orders.

## Target users
- Individual customers buying medical devices for personal or family use.
- Healthcare professionals.
- Small healthcare businesses such as clinics and diagnostic centres.

## Stack
- React
- Vite
- TypeScript
- Plain CSS (src/styles.css) — Tailwind was planned but not adopted; do not mix the two without a decision
- Supabase
- Google OAuth
- Mailgun
- Git/GitHub
- Vercel
- Playwright + TypeScript later for E2E testing

## Design direction
Professional, trustworthy, clean, modern, healthcare-oriented and easy to navigate.

Use a predominantly light interface. Suggested visual language:
- Primary: medical blue
- Secondary: teal
- Background: white/light grey
- Text: dark navy/charcoal
- Success: green
- Warning: amber
- Error: red

Use Inter (or a close sans-serif alternative) as the primary font.

## Core pages
- Home
- Products
- Product Details
- Cart
- Checkout
- Order Confirmation
- Login
- My Account / My Orders

## Core product data
A product should support: id, name, category, description, shortDescription, price, stockQuantity, imageUrl, brand, model, specifications, warranty, status and createdAt.

## Database entities
- users/profiles
- products
- orders
- order_items

Relationship: User 1-to-many Orders; Order 1-to-many Order Items; Product 1-to-many Order Items.

## Functional rules
1. Do not allow checkout quantities above available stock.
2. Do not allow out-of-stock products to be purchased.
3. Customers must only access their own orders.
4. Orders must persist after logout, browser close/reopen and later sign-in.
5. Successful checkout must trigger a confirmation email.
6. Secrets must be stored in environment variables and never committed.
7. Production authentication redirects, database access and email configuration must work after deployment.

## UI rules
- Every important screen must make the next action obvious.
- Use clear loading, success, error and empty states.
- Keep checkout short and understandable.
- Make the interface responsive for desktop, tablet and mobile.
- Product information must be easy to scan.
- Do not invent medical claims or imply clinical efficacy beyond supplied product information.

## Engineering rules
- Prefer simple, maintainable architecture over unnecessary abstraction.
- Use TypeScript types for products, cart items, users and orders.
- Keep API/database logic out of presentational components where practical.
- Do not hard-code secrets.
- Do not replace working project decisions without a reason.
- Before changing an existing feature, inspect its current implementation and preserve existing behaviour unless the requirement explicitly changes it.
- Keep README.md updated when setup, architecture or major project decisions change.

## Current phase
Phase 1 complete (static UI, mock data). Phase 2 prepared: Supabase schema, RLS and product service in place; products load from Supabase when VITE_SUPABASE_* are set, otherwise from mock data.

Next phases:
1. Static UI
2. Supabase database
3. Google authentication
4. Cart and checkout persistence
5. Mailgun confirmation email
6. Deployment
7. End-to-end testing

## Definition of done for MVP
A user can authenticate, browse products, view details and stock, add products to cart, complete checkout, have the order stored in Supabase, receive an email confirmation, log out, return later, sign in again and still see the order.
