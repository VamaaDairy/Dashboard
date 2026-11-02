-- Store: everything procured for the plant that is not milk or a costed ingredient (spares, cleaning
-- material, stationery, uniforms, tools...). Items sit in a category > subcategory tree that is set up
-- before anything is entered; every purchase is a stock "in" and every issue a stock "out". Stock on
-- hand is never stored - it is always in minus out of store_movement.

create table store_category (
  id         bigint generated always as identity primary key,
  name       text not null,
  created_at timestamptz not null default now()
);
create unique index store_category_name_uq on store_category (lower(name));

create table store_subcategory (
  id          bigint generated always as identity primary key,
  category_id bigint not null references store_category(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now()
);
create unique index store_subcategory_name_uq on store_subcategory (category_id, lower(name));

create table store_item (
  id              bigint generated always as identity primary key,
  name            text not null,
  category_id     bigint not null references store_category(id),
  subcategory_id  bigint references store_subcategory(id),
  unit            text not null default 'pcs',
  min_stock       numeric(20, 4) not null default 0,   -- flagged "low" at or below this
  active          boolean not null default true,
  notes           text,
  created_at      timestamptz not null default now()
);
create unique index store_item_name_uq on store_item (lower(name));
create index store_item_category_ix on store_item (category_id, subcategory_id);

create table store_movement (
  id          bigint generated always as identity primary key,
  item_id     bigint not null references store_item(id),
  day         date not null,
  direction   text not null check (direction in ('in', 'out')),
  qty         numeric(20, 4) not null check (qty > 0),
  rate        numeric(20, 4),            -- purchase rate per unit, for "in"
  party       text,                      -- supplier for "in"; who/what it was issued to for "out"
  ref_no      text,                      -- bill / challan number, or issue slip
  notes       text,
  created_by  text,
  created_at  timestamptz not null default now()
);
create index store_movement_item_ix on store_movement (item_id, day);
create index store_movement_day_ix on store_movement (day desc, id desc);
