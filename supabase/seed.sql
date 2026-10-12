-- Starter catalogue (matches src/data/products.ts). Safe to re-run.
insert into public.products (id, name, category, description, price, stock_quantity, brand, model, warranty, visual) values
  ('vm-001','Digital Blood Pressure Monitor','Monitoring','Automatic upper-arm blood pressure monitor with a clear digital display.',45000,12,'Vi-Medics','VM-BP-001','12 months','bp'),
  ('vm-002','Fingertip Pulse Oximeter','Monitoring','Compact fingertip pulse oximeter designed for convenient spot checks.',18000,24,'Vi-Medics','VM-PO-002','12 months','oximeter'),
  ('vm-003','Professional Stethoscope','Diagnostic','A lightweight acoustic stethoscope for routine clinical examination.',32000,3,'Vi-Medics','VM-ST-003','12 months','stethoscope'),
  ('vm-004','Portable Nebulizer','Respiratory','Compact nebulizer designed for convenient respiratory care routines.',55000,8,'Vi-Medics','VM-NB-004','12 months','nebulizer'),
  ('vm-005','Digital Medical Thermometer','Monitoring','Fast-reading digital thermometer with an easy-to-read display.',8500,31,'Vi-Medics','VM-TM-005','6 months','thermometer'),
  ('vm-006','Folding Mobility Walker','Mobility','Lightweight folding walking aid designed for everyday mobility support.',68000,6,'Vi-Medics','VM-MW-006','12 months','walker'),
  ('vm-007','Manual Wheelchair','Mobility','Foldable manual wheelchair with comfortable seating and footrests.',185000,4,'Vi-Medics','VM-WC-007','18 months','wheelchair'),
  ('vm-008','Blood Glucose Meter Kit','Diagnostic','Portable blood glucose meter kit for routine blood glucose monitoring.',29500,10,'Vi-Medics','VM-GM-008','12 months','glucose'),
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
