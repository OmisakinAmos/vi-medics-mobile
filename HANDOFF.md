# Vi-Medics handoff (2026-10-02, ~22:45 Lagos)

## Live
- Production URL: https://vi-medics.vercel.app (Vercel project `vi-medics`, id prj_ebd6whlpEy9RZaTvv3H1a0e313Cr, personal account `olutimilehinamos-5349`)
- Last deployment: dpl_3vZ5ANmdiRWPdQart8S5Rmm7ZH62 (READY). Deployed by uploading files directly (no Git repo connected).
- Build command on Vercel is `vite build` (type check skipped because it could not be run locally). Package versions were chosen from memory and built fine on Vercel.
- Currently runs on MOCK data: no VITE_SUPABASE_* env vars are set, so sign-in/ordering show "unavailable".

## Decisions
- Auth: email + password only (Supabase Auth). Google OAuth dropped.
- Orders are created only via the `place_order()` database function (stock check, prices from DB). Clients cannot insert orders directly.
- Email confirmation: `api/send-confirmation.ts` (Vercel function -> Mailgun). Skips silently until MAILGUN_API_KEY and MAILGUN_DOMAIN are set.

## Update 2026-10-03
- Supabase connected (env vars set in Vercel). Sign up/in, logout, place order verified working by the user.
- Added: show-password toggle, footer phone +234 811 386 7495, image fallback in ProductVisual, MAILGUN_BASE_URL support, Playwright tests (tests/e2e, not yet run).
- Real product photos: pending. Plan = user uploads photos to a public Supabase Storage bucket `product-images` named vm-001.jpg ... vm-008.jpg, then run: update public.products set image_url = 'https://vzisnnouahikrauajvtv.supabase.co/storage/v1/object/public/product-images/' || id || '.jpg';
- Mailgun: pending keys (MAILGUN_API_KEY, MAILGUN_DOMAIN in Vercel; sandbox needs authorised recipients).

- 2026-10-03 later: Product photos uploaded to Supabase Storage (vm-004/006/007 are .webp, rest .jpg); Mailgun sandbox keys set in Vercel (domain sandboxfbdf894d8268435b855197230762d290.mailgun.org, US region); email now has an HTML version. Mail lands in spam from the sandbox domain (needs a verified real domain with SPF/DKIM to fix). Latest deployment: dpl_HarHCwetsMCUscp3MLprXkjbjiLC.
- Open: confirm the old Mailgun key was deleted; run Playwright tests on a real machine; consider real sending domain.

- 2026-10-12: Added the Medical Consumables category (6 sample products vm-009..vm-014 with PLACEHOLDER prices/stock), the /services page (Equipment Maintenance and Servicing, enquiry by WhatsApp/phone, not in the cart), a Servicing tab in the bottom nav, and a rewritten About page. SQL run in Supabase (supabase/migrations/002-medical-consumables.sql). Deploys now go through GitHub Actions (.github/workflows/vercel-deploy.yml, secret VERCEL_TOKEN) on every push to main; the Vercel MCP connection has no project access, and Git linking was not possible (Vercel account is tied to a different GitHub login).
- PENDING (user is preparing): real list of products, images and prices. Plan = user sends name, category, price, stock quantity, brand/model/warranty and photos; images go in the public Supabase Storage bucket `product-images` named by product id (e.g. vm-009.jpg), then `image_url` is set as above; update prices/stock with SQL (`update public.products set price=..., stock_quantity=... where id=...`) and keep supabase/seed.sql, supabase/setup.sql and src/data/products.ts in sync. Do not invent medical claims; keep descriptions to supplied product information.
- Other open items: Search Console indexing requests (quota) and sitemap status check; custom domain vi-medics.ng later (then Mailgun verified domain); check the latest APK build before treating it as the submission APK (submitted link is build-2).

- 2026-10-12 (later): Admin area built at /admin (src/pages/Admin.tsx, src/pages/admin/*, src/services/adminService.ts). Needs supabase/migrations/003-admin.sql run once in Supabase; owner email olutimilehinamos@gmail.com becomes admin if that account exists. Admin table is separate from profiles on purpose (customers can edit their own profile row).

## Original to-do list (mostly done)
1. Create Supabase project; run `supabase/setup.sql` (schema + seed) in the SQL Editor.
2. Supabase -> Authentication -> Providers -> Email: turn OFF "Confirm email" (or keep on and handle the confirm flow).
3. Add env vars in Vercel (production): VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (anon key only), then redeploy.
4. Test end to end: sign up -> add to cart -> checkout -> order saved -> Logout -> sign in -> order still in My Orders. Also test an over-stock quantity.
5. Optional: Mailgun keys (MAILGUN_API_KEY, MAILGUN_DOMAIN; sandbox domains only email authorised recipients).
6. Known gaps: cart is not persisted across reloads; product-page quantity selector buttons are decorative; no real tsc/vite build was run locally; no Playwright tests yet.
