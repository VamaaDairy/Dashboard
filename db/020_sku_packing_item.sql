-- =====================================================================
-- Each SKU's own packing material
--
-- Like a bulk product's standing ingredient list, every SKU has a standing
-- packing list: which packaging items go into it and how much of each - per
-- piece (a pouch, a cup, 3.5 g of film) or per case (one box per CBX). On the
-- SKU packing page the day's material is worked out from this list and the
-- pieces / cases packed, at the packaging master's rate; it can still be
-- changed for the day.
-- =====================================================================

create table sku_packing_item (
  id            uuid primary key default gen_random_uuid(),
  sku_id        uuid not null references sku(id) on delete cascade,
  packaging_id  uuid not null references cost_object(id) on delete cascade,
  qty           numeric(20, 6) not null check (qty > 0),   -- in the packaging item's unit (pc or kg)
  per           text not null default 'pc' check (per in ('pc', 'case')),
  sort_order    int not null default 0,
  unique (sku_id, packaging_id, per)
);

create index on sku_packing_item (sku_id);
