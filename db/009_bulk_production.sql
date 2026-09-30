-- =====================================================================
-- Bulk batch production
--
-- What the plant makes in bulk each day, before anything is packed into
-- sizes: a batch of dahi, paneer or lassi base, recorded with the milk,
-- ingredients and labour that went into it. SKUs (a 200 g cup, a 500 ml
-- pouch) are packed from these batches; that link comes later.
--
--   bulk_product            - the things made in bulk, each in kg or litres.
--   bulk_batch              - one product on one day: how much came out, and
--                             the milk and labour that went in. One row per
--                             product per day - the day's batches of it together.
--   bulk_batch_ingredient   - every other ingredient in the batch, taken
--                             from the Ingredients list where possible.
-- =====================================================================

create table bulk_product (
  id           uuid primary key default gen_random_uuid(),
  scenario_id  uuid not null references scenario(id) on delete cascade,
  code         text not null,
  name         text not null,
  unit         text not null default 'kg' check (unit in ('kg', 'L')),
  is_active    boolean not null default true,
  notes        text,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (scenario_id, code),
  constraint bulk_product_code_slug check (code ~ '^[a-z][a-z0-9_]*$')
);

create table bulk_batch (
  id               uuid primary key default gen_random_uuid(),
  scenario_id      uuid not null references scenario(id) on delete cascade,
  batch_date       date not null,
  bulk_product_id  uuid not null references bulk_product(id) on delete restrict,
  batch_no         text,                         -- the plant's own batch number, if any
  output_qty       numeric(20, 4),               -- in the product's unit
  milk_litre       numeric(20, 4),
  milk_fat_pct     numeric(20, 4),
  milk_snf_pct     numeric(20, 4),
  labour_workers   numeric(20, 2),
  labour_hours     numeric(20, 2),               -- hours each worker spent on the batch
  labour_cost      numeric(20, 4),               -- rupees, when known
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (scenario_id, batch_date, bulk_product_id)
);

create table bulk_batch_ingredient (
  id             uuid primary key default gen_random_uuid(),
  batch_id       uuid not null references bulk_batch(id) on delete cascade,
  ingredient_id  uuid references cost_object(id) on delete set null,
  name           text not null,                  -- kept so a line still reads if the ingredient is removed
  qty            numeric(20, 4) not null check (qty > 0),
  unit           text not null default 'kg',
  sort_order     int not null default 0
);

create index on bulk_product (scenario_id, sort_order);
create index on bulk_batch (scenario_id, batch_date desc);
create index on bulk_batch (bulk_product_id);
create index on bulk_batch_ingredient (batch_id);

do $$
declare t text;
begin
  foreach t in array array['bulk_product', 'bulk_batch']
  loop
    execute format(
      'create trigger %1$s_touch before update on %1$s
         for each row execute function touch_updated_at()', t);
  end loop;
end $$;
