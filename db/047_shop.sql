-- Gaia online shop (the public /shop storefront).
-- Products come from fp_product (+ fp_product_image); shop_item only holds what the
-- shop decides on top of that (hidden, own price, sort). Orders placed in the shop
-- live in shop_order / shop_order_item.

create sequence shop_order_seq;

create table shop_item (
  sku_code   text primary key,
  visible    boolean not null default true,
  price      numeric(12,2) check (price >= 0),   -- null = use the product's MRP
  sort       int,
  updated_at timestamptz not null default now()
);

-- bulk / trade packs have no place in a consumer shop
insert into shop_item (sku_code, visible)
select sku_code, false from fp_product where mrp > 2000
on conflict do nothing;

create table shop_order (
  id             serial primary key,
  order_no       text not null unique default ('GS-' || lpad(nextval('shop_order_seq')::text, 6, '0')),
  -- the link in the customer's confirmation page: order numbers are guessable, this is not
  access_key     text not null unique default replace(gen_random_uuid()::text, '-', ''),
  name           text not null,
  phone          text not null,
  address        text not null,
  pincode        text,
  notes          text,
  subtotal       numeric(12,2) not null check (subtotal >= 0),
  delivery_fee   numeric(12,2) not null default 0 check (delivery_fee >= 0),
  total          numeric(12,2) not null check (total >= 0),
  payment_method text not null default 'cod' check (payment_method in ('cod')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid')),
  status         text not null default 'placed' check (status in ('placed', 'confirmed', 'out_for_delivery', 'delivered', 'cancelled')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index shop_order_status_ix on shop_order (status, created_at desc);
create index shop_order_phone_ix on shop_order (phone, created_at desc);

create table shop_order_item (
  id         serial primary key,
  order_id   int not null references shop_order(id) on delete cascade,
  sku_code   text not null,
  name       text not null,
  image_url  text,
  qty        int not null check (qty > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  line_total numeric(12,2) not null check (line_total >= 0)
);
create index shop_order_item_order_ix on shop_order_item (order_id);
