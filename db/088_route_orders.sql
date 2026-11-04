-- Route orders: the day's trade orders laid out route by route, and the Tally sales vouchers made from them.
-- Replaces the demand-sheet workbook. A customer here is one name per outlet, whatever the firm is called in the
-- order book, with the Tally ledger it bills to. A product is one name per SKU, with its Tally stock item.

create table route_order_route (
  id     serial primary key,
  name   text not null unique,
  sort   int not null default 0,
  active boolean not null default true
);

create table route_order_party (
  id                serial primary key,
  name              text not null,
  name_key          text generated always as (regexp_replace(lower(name), '[^a-z0-9]', '', 'g')) stored unique,
  route_id          int references route_order_route (id),
  channel           text not null default 'Other',
  group_name        text,
  tally_ledger      text,
  state             text,
  consignee_name    text,
  consignee_address text,
  consignee_state   text,
  consignee_pincode text,
  consignee_gstin   text,
  buyer_address     text,
  buyer_gstin       text,
  buyer_pincode     text,
  -- a stockist's outlets go on one bill per ledger (milk and the rest separately), everyone else has a bill per outlet
  consolidated      boolean not null default false,
  firm_uid          uuid unique references fp_firm (uid) on delete set null,
  review_note       text,
  active            boolean not null default true,
  updated_at        timestamptz not null default now()
);

create table route_order_product (
  id           serial primary key,
  -- the digits of fp_product.sku_code: T1042, 1,042 and 1042 are one product
  sku_no       int not null unique,
  name         text not null,
  category     text not null,
  tally_item   text,
  tally_ledger text,
  tally_unit   text,
  pack_size    numeric not null default 1,
  gst_pct      numeric not null default 0,
  shelf_days   int not null default 7,
  weight_kg    numeric not null default 0,
  -- the product's id in the plant stock API, whose batches the bills use
  stock_id     text,
  sort         int not null default 0,
  active       boolean not null default true
);

-- the next voucher number, per financial year
create table route_order_series (
  fy      text primary key,
  next_no int not null
);

create table route_order_bill (
  id           serial primary key,
  voucher_no   text not null unique,
  voucher_date date not null,
  order_date   date not null,
  party_id     int references route_order_party (id),
  ledger       text not null,
  party_name   text not null,
  route_name   text,
  channel      text,
  taxable      numeric not null,
  tax          numeric not null,
  roundoff     numeric not null,
  total        numeric not null,
  data         jsonb not null,
  status       text not null default 'issued' check (status in ('issued', 'cancelled')),
  exported_at  timestamptz,
  created_by   text not null,
  created_at   timestamptz not null default now(),
  cancelled_by text,
  cancelled_at timestamptz
);
create index route_order_bill_date on route_order_bill (order_date);

-- the live bills an order is on: usually one, two for a stockist's order with both milk and other products.
-- Cancelling a bill drops its rows here, which frees the order.
create table route_order_bill_order (
  order_uid uuid not null references fp_booking_order (uid) on delete cascade,
  bill_id   int not null references route_order_bill (id) on delete cascade,
  primary key (order_uid, bill_id)
);
create index route_order_bill_order_bill on route_order_bill_order (bill_id);
