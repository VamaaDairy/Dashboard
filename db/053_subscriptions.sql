-- Subscriptions: a customer gets a product on a schedule (daily, alternate days, chosen weekdays,
-- every N days, or daily except every Nth day) from a start date, optionally until an end date. Any single day can be skipped
-- or given a different quantity. Each evening the next day's deliveries become ordinary orders
-- (one per customer per day), so riders, tracking and cash collection work as for any order.

create table shop_subscription (
  id          serial primary key,
  customer_id int not null references shop_customer(id) on delete cascade,
  sku_code    text not null,
  qty         int not null check (qty between 1 and 20),
  frequency   text not null check (frequency in ('daily', 'alternate', 'weekdays', 'every_n', 'skip_n')),
  weekdays    int[] check (weekdays <@ array[1, 2, 3, 4, 5, 6, 7]),   -- ISO: 1 = Monday ... 7 = Sunday
  every_n     int check (every_n between 2 and 30),                 -- the N of every_n / skip_n
  start_date  date not null,
  end_date    date,
  status      text not null default 'active' check (status in ('active', 'paused', 'cancelled')),
  -- where it goes, copied from checkout so a change of address on one order doesn't move the subscription
  name        text not null,
  phone       text not null,
  address     text not null,
  pincode     text,
  lat         double precision check (lat between -90 and 90),
  lng         double precision check (lng between -180 and 180),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (frequency <> 'weekdays' or cardinality(weekdays) > 0),
  check (frequency not in ('every_n', 'skip_n') or every_n is not null),
  check (end_date is null or end_date >= start_date)
);
create index shop_subscription_customer_ix on shop_subscription (customer_id, status);

-- one day differing from the plan: qty 0 = skip that day
create table shop_subscription_day (
  subscription_id int not null references shop_subscription(id) on delete cascade,
  day             date not null,
  qty             int not null check (qty between 0 and 20),
  primary key (subscription_id, day)
);

-- an order made from subscriptions remembers its delivery day; one per customer per day
alter table shop_order add column subscription_day date;
create unique index shop_order_subscription_day_ix on shop_order (customer_id, subscription_day) where subscription_day is not null;
