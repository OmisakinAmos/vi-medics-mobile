-- Adds the Wound Care category. Safe to re-run.
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.
alter table public.products drop constraint if exists products_category_check;
alter table public.products add constraint products_category_check
  check (category in ('Monitoring','Diagnostic','Mobility','Respiratory','Wound Care','Medical Consumables','General'));
