-- Offers for the D2C app, set up in the Dashboard (Marketing > Offers) and applied by the server to every order.
--
-- kind
--   percent    X% off what qualifies (optionally capped at max_discount for the whole order)
--   flat       ₹X off: per unit of a qualifying product / category, or once off the cart
--   free_item  buy N get M free (the same product, or free_sku); on the whole cart: a gift once the cart reaches min_amount
-- applies_to
--   cart       the whole order;  products: the SKUs in skus;  categories: the app categories in categories
-- An offer with a code only applies when the customer enters that code; without one it applies by itself.

create table shop_offer (
  id                 serial primary key,
  title              text not null check (length(title) between 2 and 80),
  badge              text check (badge is null or length(badge) <= 24),
  description        text,
  kind               text not null check (kind in ('percent', 'flat', 'free_item')),
  applies_to         text not null default 'products' check (applies_to in ('cart', 'products', 'categories')),
  skus               text[] not null default '{}',
  categories         text[] not null default '{}',
  percent            numeric(5, 2) check (percent is null or (percent > 0 and percent <= 100)),
  amount             numeric(10, 2) check (amount is null or amount > 0),
  max_discount       numeric(10, 2) check (max_discount is null or max_discount > 0),
  buy_qty            int check (buy_qty is null or buy_qty between 1 and 100),
  free_sku           text,
  free_qty           int check (free_qty is null or free_qty between 1 and 20),
  repeat             boolean not null default true,
  min_qty            int not null default 0 check (min_qty >= 0),
  min_amount         numeric(10, 2) not null default 0 check (min_amount >= 0),
  code               text check (code is null or code ~ '^[A-Z0-9]{3,20}$'),
  first_order_only   boolean not null default false,
  per_customer_limit int check (per_customer_limit is null or per_customer_limit > 0),
  total_limit        int check (total_limit is null or total_limit > 0),
  starts_at          timestamptz,
  ends_at            timestamptz,
  active             boolean not null default true,
  show_in_app        boolean not null default true,
  priority           int not null default 0,
  created_by         text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at),
  check (kind <> 'percent' or percent is not null),
  check (kind <> 'flat' or amount is not null),
  check (kind <> 'free_item' or (free_qty is not null and (applies_to = 'cart' or buy_qty is not null))),
  check (applies_to <> 'products' or cardinality(skus) > 0),
  check (applies_to <> 'categories' or cardinality(categories) > 0)
);
create unique index shop_offer_code_ux on shop_offer (code) where code is not null;
create index shop_offer_live_ix on shop_offer (active, priority desc);

-- which offers an order used, and what each gave
create table shop_order_offer (
  order_id   int not null references shop_order (id) on delete cascade,
  offer_id   int not null references shop_offer (id) on delete restrict,
  title      text not null,
  discount   numeric(10, 2) not null default 0,
  free_units int not null default 0,
  primary key (order_id, offer_id)
);
create index shop_order_offer_offer_ix on shop_order_offer (offer_id);

-- the order: subtotal stays the items at full price; discount is taken off before delivery and the total
alter table shop_order add column discount numeric(10, 2) not null default 0,
                       add column coupon_code text;
-- a line's own discount (included in the order's), and the free lines an offer added (price 0)
alter table shop_order_item add column discount numeric(10, 2) not null default 0,
                            add column free boolean not null default false,
                            add column offer_id int references shop_offer (id) on delete set null;

-- banners can open a product, a whole category, or an offer
alter table shop_banner add column category text,
                        add column offer_id int references shop_offer (id) on delete set null;
