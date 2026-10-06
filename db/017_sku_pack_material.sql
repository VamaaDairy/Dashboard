-- =====================================================================
-- Packing material used for each SKU each day
--
-- When a SKU is packed, the pouches, cups, boxes, film... that went into it
-- are entered on the SKU packing page: the item, the quantity, whether it is
-- counted per kg or per piece, and the price per that unit. The amount is
-- qty x price. An item picked from the Packaging master keeps its link; one
-- typed in just keeps its name.
-- =====================================================================

create table sku_pack_material (
  id            uuid primary key default gen_random_uuid(),
  scenario_id   uuid not null references scenario(id) on delete cascade,
  sku_id        uuid not null references sku(id) on delete cascade,
  day           date not null,
  packaging_id  uuid references cost_object(id) on delete set null,
  name          text not null,
  qty           numeric(20, 3) not null check (qty > 0),
  unit          text not null check (unit in ('kg', 'pcs')),
  price         numeric(20, 4) not null check (price >= 0),   -- ₹ per kg or per piece
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

create index on sku_pack_material (sku_id, day);
create index on sku_pack_material (scenario_id, day desc);
