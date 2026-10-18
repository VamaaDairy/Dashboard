-- Orders: pricing extras, customer extras, HR / field-force extras, engagement.

-- pricing -------------------------------------------------------------
create table ord_channel_rate (
  id         uuid primary key default gen_random_uuid(),
  channel_id uuid not null references ord_master(id) on delete cascade,
  product_id uuid not null references ord_product(id) on delete cascade,
  margin_pct numeric(5,2) not null default 0,
  rate       numeric(12,2) not null check (rate >= 0),
  unique (channel_id, product_id)
);
create table ord_slab (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references ord_product(id) on delete cascade,
  min_qty    numeric(12,3) not null check (min_qty >= 0),
  max_qty    numeric(12,3),
  rate       numeric(12,2) not null check (rate >= 0)
);
create table ord_planogram (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  channel_id uuid references ord_master(id) on delete set null,
  product_id uuid not null references ord_product(id) on delete cascade,
  shelf      text,
  facings    int not null default 1
);
create table ord_green_target (
  id         uuid primary key default gen_random_uuid(),
  staff_id   uuid not null references ord_staff(id) on delete cascade,
  product_id uuid not null references ord_product(id) on delete cascade,
  period     text not null check (period ~ '^\d{4}-\d{2}$'),
  target     int not null check (target >= 0),
  unique (staff_id, product_id, period)
);

-- customers -----------------------------------------------------------
create table ord_unmap_request (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references ord_customer(id) on delete cascade,
  staff_id     uuid references ord_staff(id) on delete set null,
  requested_on date not null default current_date,
  reason       text,
  status       text not null default 'pending' check (status in ('pending','approved','rejected'))
);
create table ord_customer_target (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references ord_customer(id) on delete cascade,
  period      text not null check (period ~ '^\d{4}-\d{2}$'),
  target      numeric(14,2) not null check (target >= 0),
  unique (customer_id, period)
);

-- employees / field force ---------------------------------------------
create table ord_leave (
  id        uuid primary key default gen_random_uuid(),
  staff_id  uuid not null references ord_staff(id) on delete cascade,
  from_date date not null,
  to_date   date not null,
  type      text not null default 'casual' check (type in ('casual','sick','earned','unpaid')),
  reason    text,
  status    text not null default 'pending' check (status in ('pending','approved','rejected')),
  check (to_date >= from_date)
);
create table ord_holiday (
  id   uuid primary key default gen_random_uuid(),
  day  date not null unique,
  name text not null
);
create table ord_hiring (
  id            uuid primary key default gen_random_uuid(),
  candidate     text not null,
  designation_id uuid references ord_master(id) on delete set null,
  region        text,
  phone         text,
  stage         text not null default 'applied' check (stage in ('applied','interview','offered','joined','rejected')),
  expected_join date
);
create table ord_promoter (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text,
  customer_id uuid references ord_customer(id) on delete set null,
  staff_id    uuid references ord_staff(id) on delete set null,
  joined_on   date,
  is_active   boolean not null default true
);
create table ord_display_audit (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references ord_customer(id) on delete cascade,
  staff_id    uuid references ord_staff(id) on delete set null,
  audit_date  date not null default current_date,
  score       int not null default 0 check (score between 0 and 100),
  compliant   boolean not null default false,
  notes       text
);
create table ord_location_log (
  id        uuid primary key default gen_random_uuid(),
  staff_id  uuid not null references ord_staff(id) on delete cascade,
  logged_on date not null default current_date,
  logged_at time not null default localtime(0),
  lat       numeric(9,6) not null check (lat between -90 and 90),
  lng       numeric(9,6) not null check (lng between -180 and 180),
  note      text
);
create index ord_location_log_staff on ord_location_log(staff_id, logged_on desc);

-- engagement ----------------------------------------------------------
create table ord_broadcast (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text,
  audience_id uuid references ord_master(id) on delete set null,   -- a designation; empty = everyone
  sent_on     date not null default current_date,
  status      text not null default 'draft' check (status in ('draft','sent'))
);
create table ord_catalogue (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  product_id uuid references ord_product(id) on delete set null,
  url        text,
  is_active  boolean not null default true
);
create table ord_quiz (
  id       uuid primary key default gen_random_uuid(),
  title    text not null,
  topic    text,
  pass_pct int not null default 60 check (pass_pct between 0 and 100),
  is_active boolean not null default true
);
create table ord_quiz_question (
  id       uuid primary key default gen_random_uuid(),
  quiz_id  uuid not null references ord_quiz(id) on delete cascade,
  question text not null,
  option_a text not null,
  option_b text not null,
  option_c text,
  option_d text,
  answer   text not null check (answer in ('a','b','c','d'))
);
create table ord_quiz_result (
  id        uuid primary key default gen_random_uuid(),
  quiz_id   uuid not null references ord_quiz(id) on delete cascade,
  staff_id  uuid not null references ord_staff(id) on delete cascade,
  score_pct int not null check (score_pct between 0 and 100),
  taken_on  date not null default current_date
);
