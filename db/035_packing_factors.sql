-- =====================================================================
-- Packing quantities with their working, and saved packs per product
--
-- A packing line's quantity used to be a bare number. Many of them are really
-- calculated - 2.94 g of film in a packet, 350 pieces from a kg of film, one
-- carton shared by 300 pouches - so the line now keeps how it was worked out
-- (basis + factor) and the quantity is derived from it, so the factor can be
-- changed and the cost follows.
--
--   qty      the quantity itself (factor is null)
--   grams    factor = grams of material in one piece      -> qty = factor / 1000 kg
--   per_kg   factor = pieces made from 1 kg of material    -> qty = 1 / factor kg
--   share    factor = pieces one item covers               -> qty = 1 / factor
--
-- A pack template is a packing list saved against a bulk product (or none)
-- so it can be loaded onto a SKU - e.g. 200 ml toned milk film before that
-- SKU exists.
-- =====================================================================

alter table sku_packing_item
  add column basis  text not null default 'qty' check (basis in ('qty', 'grams', 'per_kg', 'share')),
  add column factor numeric(20, 6) check (factor is null or factor > 0);

create table pack_template (
  id              uuid primary key default gen_random_uuid(),
  scenario_id     uuid not null references scenario(id) on delete cascade,
  bulk_product_id uuid references bulk_product(id) on delete set null,
  name            text not null,
  note            text,
  sort_order      int not null default 0,
  unique (scenario_id, name)
);

create table pack_template_item (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid not null references pack_template(id) on delete cascade,
  packaging_id  uuid not null references cost_object(id) on delete cascade,
  qty           numeric(20, 6) not null check (qty > 0),
  per           text not null default 'pc' check (per in ('pc', 'case')),
  basis         text not null default 'qty' check (basis in ('qty', 'grams', 'per_kg', 'share')),
  factor        numeric(20, 6) check (factor is null or factor > 0),
  sort_order    int not null default 0
);

create index on pack_template_item (template_id);
