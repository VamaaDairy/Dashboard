-- =====================================================================
-- WhatsApp shop
--
-- Customers chat, browse, order, pay and review over WhatsApp (Cloud API).
-- A Groq-hosted model answers them; the dashboard shows every conversation
-- and order, and lets a person take over any chat.
--
-- Products are never typed in here: wa_product is a copy of the Meta
-- (WhatsApp) catalog, refreshed from the Graph API.
-- =====================================================================

create table if not exists wa_product (
  retailer_id   text primary key,              -- the catalog's content id / SKU
  meta_id       text,                          -- Graph API product id
  name          text not null,
  description   text not null default '',
  price         numeric,                       -- parsed from the catalog's price string
  price_text    text,                          -- as the catalog formats it, e.g. "₹250.00"
  currency      text not null default 'INR',
  image_url     text,
  url           text,
  availability  text,                          -- 'in stock', 'out of stock', ...
  active        boolean not null default true, -- false once it disappears from the catalog
  raw           jsonb,
  synced_at     timestamptz not null default now()
);

create table if not exists wa_contact (
  wa_id              text primary key,         -- the customer's WhatsApp number, digits only
  name               text,
  bot_enabled        boolean not null default true,
  needs_human        boolean not null default false,
  unread             integer not null default 0,
  cart               jsonb not null default '[]'::jsonb,   -- [{retailer_id, qty}]
  delivery_name      text,
  delivery_address   text,
  pending_review_order_id integer,             -- next text from them is that review's comment
  last_message_at    timestamptz,
  last_inbound_at    timestamptz,              -- free-form replies only within 24h of this
  created_at         timestamptz not null default now()
);

-- Photos and documents, stored here rather than on disk so they survive redeploys.
create table if not exists wa_media (
  id           bigserial primary key,
  meta_media_id text unique,
  mime         text not null,
  filename     text,
  bytes        bytea not null,
  size         integer not null,
  created_at   timestamptz not null default now()
);

create sequence if not exists wa_order_no_seq start 1001;

create table if not exists wa_order (
  id               serial primary key,
  order_no         text not null unique default ('WA' || nextval('wa_order_no_seq')),
  wa_id            text not null references wa_contact(wa_id),
  status           text not null default 'placed'
                   check (status in ('placed','confirmed','packed','shipped','delivered','cancelled')),
  payment_method   text not null default 'upi' check (payment_method in ('upi','cod','link')),
  payment_status   text not null default 'unpaid'
                   check (payment_status in ('unpaid','verifying','paid','refunded')),
  payment_link     text,
  payment_ref      text,
  subtotal         numeric not null default 0,
  delivery_fee     numeric not null default 0,
  total            numeric not null default 0,
  currency         text not null default 'INR',
  delivery_name    text,
  delivery_address text,
  notes            text,
  source           text not null default 'chat' check (source in ('chat','catalog')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists wa_order_wa_id_idx on wa_order (wa_id, created_at desc);

create table if not exists wa_order_item (
  id          serial primary key,
  order_id    integer not null references wa_order(id) on delete cascade,
  retailer_id text not null,
  name        text not null,
  image_url   text,
  qty         integer not null check (qty > 0),
  unit_price  numeric not null,
  line_total  numeric not null
);

create table if not exists wa_message (
  id             bigserial primary key,
  wa_message_id  text unique,                  -- Meta's wamid, null until sent
  wa_id          text not null references wa_contact(wa_id),
  direction      text not null check (direction in ('in','out')),
  sender         text not null check (sender in ('customer','bot','agent','system')),
  type           text not null,                -- text, image, document, order, interactive, ...
  body           text,
  media_id       bigint references wa_media(id),
  payload        jsonb,
  status         text,                         -- out: sent / delivered / read / failed
  error          text,
  order_id       integer references wa_order(id),
  created_at     timestamptz not null default now()
);
create index if not exists wa_message_contact_idx on wa_message (wa_id, created_at);
create index if not exists wa_message_order_idx on wa_message (order_id) where order_id is not null;

create table if not exists wa_review (
  id          serial primary key,
  order_id    integer references wa_order(id),
  wa_id       text not null references wa_contact(wa_id),
  rating      integer not null check (rating between 1 and 5),
  comment     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists wa_review_order_uidx on wa_review (order_id) where order_id is not null;

create table if not exists wa_setting (
  key    text primary key,
  value  text,
  updated_at timestamptz not null default now()
);
