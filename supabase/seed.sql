-- Starter catalogue (matches src/data/products.ts). Safe to re-run.
insert into public.products (id, name, category, description, price, stock_quantity, brand, model, warranty, visual) values
  ('vm-001','Digital Blood Pressure Monitor','Monitoring','Automatic upper-arm blood pressure monitor with a clear digital display.',45000,12,'Vi-Medics','VM-BP-001','12 months','bp'),
  ('vm-002','Fingertip Pulse Oximeter','Monitoring','Compact fingertip pulse oximeter designed for convenient spot checks.',18000,24,'Vi-Medics','VM-PO-002','12 months','oximeter'),
  ('vm-003','Professional Stethoscope','Diagnostic','A lightweight acoustic stethoscope for routine clinical examination.',32000,3,'Vi-Medics','VM-ST-003','12 months','stethoscope'),
  ('vm-004','Portable Nebulizer','Respiratory','Compact nebulizer designed for convenient respiratory care routines.',55000,8,'Vi-Medics','VM-NB-004','12 months','nebulizer'),
  ('vm-005','Digital Medical Thermometer','Monitoring','Fast-reading digital thermometer with an easy-to-read display.',8500,31,'Vi-Medics','VM-TM-005','6 months','thermometer'),
  ('vm-006','Folding Mobility Walker','Mobility','Lightweight folding walking aid designed for everyday mobility support.',68000,6,'Vi-Medics','VM-MW-006','12 months','walker'),
  ('vm-007','Manual Wheelchair','Mobility','Foldable manual wheelchair with comfortable seating and footrests.',185000,4,'Vi-Medics','VM-WC-007','18 months','wheelchair'),
  ('vm-008','Blood Glucose Meter Kit','Diagnostic','Portable blood glucose meter kit for routine blood glucose monitoring.',29500,10,'Vi-Medics','VM-GM-008','12 months','glucose')
on conflict (id) do update set
  name = excluded.name, category = excluded.category, description = excluded.description,
  price = excluded.price, stock_quantity = excluded.stock_quantity, brand = excluded.brand,
  model = excluded.model, warranty = excluded.warranty, visual = excluded.visual;
