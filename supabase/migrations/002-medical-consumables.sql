-- Adds the Medical Consumables category and sample products. Safe to re-run.
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.
alter table public.products drop constraint if exists products_category_check;
update public.products set category = 'Medical Consumables' where category = 'Disposables';
alter table public.products add constraint products_category_check
  check (category in ('Monitoring','Diagnostic','Mobility','Respiratory','Medical Consumables','General'));

insert into public.products (id, name, category, description, price, stock_quantity, brand, model, warranty, visual) values
  ('vm-009','Nitrile Examination Gloves (Box of 100)','Medical Consumables','Powder-free disposable nitrile examination gloves, supplied in a box of 100. Single use.',9500,40,'Vi-Medics','VM-DS-009','Single use','disposable'),
  ('vm-010','Disposable Syringes 5 ml (Box of 100)','Medical Consumables','Sterile single-use 5 ml syringes with needle, supplied in a box of 100. Single use only.',7500,35,'Vi-Medics','VM-DS-010','Single use','disposable'),
  ('vm-011','3-Ply Disposable Face Masks (Box of 50)','Medical Consumables','Three-layer disposable face masks with ear loops, supplied in a box of 50.',3500,60,'Vi-Medics','VM-DS-011','Single use','disposable'),
  ('vm-012','Sterile Gauze Swabs (Pack of 100)','Medical Consumables','Sterile cotton gauze swabs for general wound care and clinical dressing use. Single use.',2500,50,'Vi-Medics','VM-DS-012','Single use','disposable'),
  ('vm-013','Alcohol Prep Pads (Box of 100)','Medical Consumables','Individually wrapped isopropyl alcohol prep pads for skin cleaning before injections and sampling.',3000,45,'Vi-Medics','VM-DS-013','Single use','disposable'),
  ('vm-014','Disposable Couch Roll (Pack of 6)','Medical Consumables','Disposable paper couch roll for examination couches, supplied as a pack of 6 rolls.',4500,25,'Vi-Medics','VM-DS-014','Single use','disposable')
on conflict (id) do update set
  name = excluded.name, category = excluded.category, description = excluded.description,
  price = excluded.price, stock_quantity = excluded.stock_quantity, brand = excluded.brand,
  model = excluded.model, warranty = excluded.warranty, visual = excluded.visual;
