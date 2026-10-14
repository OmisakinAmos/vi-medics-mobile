# Vi-Medics security notes

Last review: 2026-10-14 (vulnerability analysis and attack tests against the database rules, order functions and email API).

## How it was tested
A local Postgres copy of the real schema (schema.sql, 003, 006, 007) was attacked as three roles: a logged-out visitor, a logged-in customer ("Mallory") targeting another customer ("Alice"), and an admin. About 50 attacks were scripted: reading or editing other people's data, making yourself admin, forging audit entries, changing bank details, calling internal functions, bad quantities, SQL injection text, oversized and malformed input, and stock abuse.

## Findings and fixes
| # | Finding | Severity | Fix |
|---|---|---|---|
| F1 | One customer could reserve all stock with unpaid orders (Mallory took 10 of 10 units) | High | 007: max 3 unpaid orders per customer; unpaid orders auto-expire after 24h; customers can cancel their own |
| F2 | `place_order` accepted invalid emails, 2 MB addresses, duplicate lines | Medium | 007: strict validation and length caps, merged duplicate lines, quantity cap |
| F3 | Customers could not cancel an unpaid order | Low | 007 `cancel_my_order` + Cancel button in My Orders |
| F4 | Audit trail could be flooded by sign-in pings | Low | 007: one sign-in/out entry per user per 5 minutes |
| F5 | Receipt email endpoint could be called repeatedly (email bombing, Mailgun quota) | Medium | 007 `claim_receipt_send`: one per order per 2 min; request size limit |
| F6 | Bank details were readable by logged-out visitors | Low | 007: signed-in users only, known keys only |
| F7 | No browser security headers | Medium | `vercel.json`: CSP, HSTS, frame denial, nosniff, referrer and permissions policies |
| F8 | Android app data could be backed up/extracted | Low | `allowBackup="false"` |
| F9 | Dependencies and CI actions not monitored | Low | Dependabot weekly; CI token is read-only |

## Held up under attack (no change needed)
- Customers cannot see, change, pay for or cancel other customers' orders; profiles are private.
- Nobody but an admin can change products, prices, order status or bank details; `admins` cannot be edited from the app.
- The audit trail cannot be written or edited from the app, only read by admins.
- Internal functions (`write_audit`) are not callable from the browser.
- SQL injection text is treated as plain text. Negative, zero, huge and over-stock quantities are rejected.
- Prices and totals are computed in the database, never trusted from the browser.
- Receipt emails escape customer text (HTML in a name is shown as text, not run).
- Secrets live in environment variables only. The Supabase anon key is public by design; the RLS rules protect the data.

- Accounting data (`product_costs`, `order_item_costs`, `expenses`) is admin-only. Tested: visitors and customers get no rows and cannot write; bad amounts and categories are rejected; every change is audited. Cost prices are kept off the public products table on purpose.

## Not testable from our side (do these in the dashboards)
- Supabase -> Authentication: keep Google as the only provider; turn off "Allow new users to sign up" for any unused provider; set Site URL and Redirect URLs to the production site only.
- Supabase -> Authentication: enable leaked-password protection if email login is ever added. Turn on MFA for the owner account and the admin Google account.
- Supabase -> Project settings -> API: never expose the `service_role` key in Vercel `VITE_*` variables.
- GitHub -> Settings: turn on 2FA, branch protection for `main`, secret scanning and push protection.
- Vercel and Mailgun accounts: 2FA on; rotate the Mailgun API key if it was ever pasted in chat.
- Take a Supabase backup before big changes (Database -> Backups).

## Reporting a problem
Contact the site owner directly. Do not post details publicly.
