-- One name for every product, everywhere in the dashboard: the name the Gaia D2C app shows (its own name on the
-- D2C list, else the Product Master name without the quantity), with the pack quantity and unit kept apart and the
-- product's first photo. Rebuilt by the app (src/lib/products/names.ts) whenever the Product Master, the D2C list
-- or the photos change, so reports can join it in SQL. sku_no is the digits of the SKU code: T1042, 1,042 and 1042
-- are one product, which is how the other lists (production SKUs, route orders, shop items) refer to it.

create table product_label (
  product_uid uuid primary key references fp_product (uid) on delete cascade,
  sku_code    text not null,
  sku_no      bigint,
  name        text not null,
  qty         text,
  unit        text,
  image       text
);
create index product_label_sku_no_ix on product_label (sku_no);

create table product_label_state (
  id           int primary key default 1 check (id = 1),
  fingerprint  text not null,
  refreshed_at timestamptz not null default now()
);
