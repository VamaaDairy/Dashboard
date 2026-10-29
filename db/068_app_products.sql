-- Product Master for the apps: one product list per app channel - D2C (the Gaia shop app), Retail and
-- Distributors (the Gaia Partners app). Each list decides, for its app only, which products are shown, in
-- what order, under which category and with what name and size. The company Product Master (fp_product)
-- stays the source of the product itself (SKU, MRP, photos); an empty name / size / category here means
-- "as in the Product Master".

create table app_product (
  channel     text not null check (channel in ('d2c', 'retail', 'distributor')),
  product_uid uuid not null references fp_product (uid) on delete cascade,
  name        text,                       -- shown name without the quantity; null = from the Product Master name
  size        text,                       -- quantity shown under the name ("500 ml", "1 Ltr"); null = from the name
  category    text,                       -- null = the Product Master category
  visible     boolean not null default true,
  sort        int not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (channel, product_uid)
);
create index app_product_order_ix on app_product (channel, sort);

-- the order of the categories in each app
create table app_category (
  channel    text not null check (channel in ('d2c', 'retail', 'distributor')),
  name       text not null,
  sort       int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (channel, name)
);

-- start every list as the apps are today: the categories in the app order (Milk, Paneer, Ghee, Desserts,
-- Beverages, UHT Milk, Dahi, then the rest by name) ...
with cats as (
  select c.name, row_number() over (
           order by coalesce(array_position(array['Milk', 'Paneer', 'Ghee', 'Desserts', 'Beverages', 'UHT Milk', 'Dahi'], c.name), 100), c.name) as n
  from (select distinct trim(category) as name from fp_product where active = 1 and mrp > 0 and nullif(trim(category), '') is not null) c
)
insert into app_category (channel, name, sort)
select ch, name, n * 10 from cats cross join unnest(array['d2c', 'retail', 'distributor']) ch
on conflict do nothing;

-- ... and every product with an MRP on each list, in the shop's order. The shop's hidden products (bulk packs,
-- Maxx) stay hidden in D2C only; distributors and retailers see everything, as they do now.
with ordered as (
  select p.uid, coalesce(si.visible, true) as shop_visible,
         row_number() over (order by si.sort nulls last, p.position nulls last, p.sku_name) as n
  from fp_product p
  left join shop_item si on si.sku_code = p.sku_code
  where p.active = 1 and p.mrp > 0
)
insert into app_product (channel, product_uid, visible, sort)
select ch, uid, case when ch = 'd2c' then shop_visible else true end, n * 10
from ordered cross join unnest(array['d2c', 'retail', 'distributor']) ch
on conflict do nothing;

insert into master_audit (actor, slug, record_id, action, summary, before, after)
values ('Migration 068', 'productmaster', 'app lists', 'create',
        'Product Master for the apps: separate D2C, Retail and Distributor product lists', null, null);
