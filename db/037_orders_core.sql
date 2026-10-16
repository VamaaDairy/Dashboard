-- =====================================================================
-- Orders / DMS / Field force core (rebuild of the Footprints portal spec in
-- src/app/md.md, trimmed to the entities the dashboard actually uses).
-- All tables are prefixed ord_.
-- =====================================================================

create sequence ord_order_seq;
create sequence ord_po_seq;
create sequence ord_ticket_seq;

-- generic lookup lists: category, brand, channel, designation, region, expense_type
create table ord_master (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null,
  name       text not null,
  code       text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  unique (kind, name)
);

create table ord_staff (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,
  name           text not null,
  designation_id uuid references ord_master(id) on delete set null,
  phone          text,
  email          text,
  reporting_to   uuid references ord_staff(id) on delete set null,
  region         text,
  joined_on      date,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

create table ord_customer (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,
  name         text not null,
  type         text not null default 'retailer' check (type in ('distributor','retailer','institution')),
  channel_id   uuid references ord_master(id) on delete set null,
  parent_id    uuid references ord_customer(id) on delete set null,   -- the distributor serving a retailer
  staff_id     uuid references ord_staff(id) on delete set null,      -- salesman
  contact      text,
  phone        text,
  email        text,
  address      text,
  city         text,
  state        text,
  gst_no       text,
  credit_limit numeric(14,2) not null default 0,
  credit_days  int not null default 0,
  status       text not null default 'active' check (status in ('active','pending','inactive')),
  created_at   timestamptz not null default now()
);
create index ord_customer_parent on ord_customer(parent_id);

create table ord_beat (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  staff_id       uuid references ord_staff(id) on delete set null,
  distributor_id uuid references ord_customer(id) on delete set null,
  weekday        text check (weekday in ('Mon','Tue','Wed','Thu','Fri','Sat','Sun')),
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);
alter table ord_customer add column beat_id uuid references ord_beat(id) on delete set null;

create table ord_product (
  id             uuid primary key default gen_random_uuid(),
  sku            text not null unique,
  name           text not null,
  category_id    uuid references ord_master(id) on delete set null,
  brand_id       uuid references ord_master(id) on delete set null,
  uom            text not null default 'pc',
  units_per_case int not null default 1,
  mrp            numeric(12,2) not null default 0,
  rate           numeric(12,2) not null default 0,     -- selling rate to the trade
  gst_pct        numeric(5,2) not null default 0,
  hsn            text,
  is_focus       boolean not null default false,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

create table ord_scheme (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  product_id   uuid references ord_product(id) on delete cascade,
  min_qty      numeric(12,3) not null default 0,
  free_qty     numeric(12,3) not null default 0,
  discount_pct numeric(5,2) not null default 0,
  valid_from   date,
  valid_to     date,
  is_active    boolean not null default true
);

-- primary = distributor buys from the company, secondary = retailer buys via a distributor, counter = walk-in
create table ord_order (
  id            uuid primary key default gen_random_uuid(),
  order_no      text not null unique default ('ORD-' || lpad(nextval('ord_order_seq')::text, 6, '0')),
  kind          text not null check (kind in ('primary','secondary','counter')),
  customer_id   uuid references ord_customer(id) on delete restrict,
  customer_name text,                                 -- counter sales to someone not in the master
  staff_id      uuid references ord_staff(id) on delete set null,
  order_date    date not null default current_date,
  status        text not null default 'created' check (status in ('created','approved','invoiced','delivered','cancelled')),
  notes         text,
  subtotal      numeric(14,2) not null default 0,
  tax           numeric(14,2) not null default 0,
  total         numeric(14,2) not null default 0,
  created_at    timestamptz not null default now()
);
create index ord_order_kind_date on ord_order(kind, order_date desc);
create index ord_order_customer on ord_order(customer_id);

create table ord_order_item (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references ord_order(id) on delete cascade,
  product_id   uuid not null references ord_product(id) on delete restrict,
  qty          numeric(12,3) not null check (qty > 0),
  rate         numeric(12,2) not null default 0,
  discount_pct numeric(5,2) not null default 0,
  gst_pct      numeric(5,2) not null default 0,
  amount       numeric(14,2) not null default 0      -- after discount, before tax
);
create index ord_order_item_order on ord_order_item(order_id);

-- signed quantity ledger; stock on hand = sum(qty)
create table ord_stock_move (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references ord_product(id) on delete cascade,
  qty        numeric(12,3) not null,
  reason     text not null check (reason in ('opening','purchase','sale','adjust','return')),
  ref_type   text,
  ref_id     uuid,
  note       text,
  moved_on   date not null default current_date,
  created_at timestamptz not null default now()
);
create index ord_stock_move_product on ord_stock_move(product_id);
create index ord_stock_move_ref on ord_stock_move(ref_type, ref_id);

create table ord_purchase (
  id        uuid primary key default gen_random_uuid(),
  po_no     text not null unique default ('PO-' || lpad(nextval('ord_po_seq')::text, 5, '0')),
  supplier  text not null,
  po_date   date not null default current_date,
  status    text not null default 'draft' check (status in ('draft','ordered','received','cancelled')),
  notes     text,
  total     numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);
create table ord_purchase_item (
  id          uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references ord_purchase(id) on delete cascade,
  product_id  uuid not null references ord_product(id) on delete restrict,
  qty         numeric(12,3) not null check (qty > 0),
  rate        numeric(12,2) not null default 0,
  gst_pct     numeric(5,2) not null default 0,
  amount      numeric(14,2) not null default 0
);

-- field force
create table ord_visit (
  id          uuid primary key default gen_random_uuid(),
  staff_id    uuid not null references ord_staff(id) on delete cascade,
  customer_id uuid references ord_customer(id) on delete set null,
  visit_date  date not null default current_date,
  outcome     text not null default 'no_order' check (outcome in ('order','no_order','closed','follow_up')),
  order_value numeric(14,2) not null default 0,
  notes       text,
  created_at  timestamptz not null default now()
);
create index ord_visit_date on ord_visit(visit_date desc);

create table ord_attendance (
  id        uuid primary key default gen_random_uuid(),
  staff_id  uuid not null references ord_staff(id) on delete cascade,
  day       date not null default current_date,
  status    text not null default 'present' check (status in ('present','absent','leave','half')),
  check_in  time,
  check_out time,
  unique (staff_id, day)
);

create table ord_expense (
  id        uuid primary key default gen_random_uuid(),
  staff_id  uuid not null references ord_staff(id) on delete cascade,
  day       date not null default current_date,
  type_id   uuid references ord_master(id) on delete set null,
  amount    numeric(12,2) not null check (amount >= 0),
  status    text not null default 'pending' check (status in ('pending','approved','rejected')),
  note      text
);

create table ord_task (
  id        uuid primary key default gen_random_uuid(),
  title     text not null,
  staff_id  uuid references ord_staff(id) on delete set null,
  due_date  date,
  priority  text not null default 'medium' check (priority in ('low','medium','high')),
  status    text not null default 'open' check (status in ('open','in_progress','done')),
  notes     text
);

create table ord_kpi_target (
  id       uuid primary key default gen_random_uuid(),
  staff_id uuid not null references ord_staff(id) on delete cascade,
  period   text not null check (period ~ '^\d{4}-\d{2}$'),
  metric   text not null check (metric in ('sales','orders','visits','new_outlets')),
  target   numeric(14,2) not null check (target >= 0),
  unique (staff_id, period, metric)
);

create table ord_ticket (
  id          uuid primary key default gen_random_uuid(),
  ticket_no   text not null unique default ('TKT-' || lpad(nextval('ord_ticket_seq')::text, 5, '0')),
  subject     text not null,
  customer_id uuid references ord_customer(id) on delete set null,
  staff_id    uuid references ord_staff(id) on delete set null,
  priority    text not null default 'medium' check (priority in ('low','medium','high')),
  status      text not null default 'open' check (status in ('open','in_progress','resolved','closed')),
  description text,
  resolution  text,
  created_at  timestamptz not null default now(),
  closed_at   timestamptz
);
