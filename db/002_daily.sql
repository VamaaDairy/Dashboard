-- =====================================================================
-- Daily production costing
--
-- One row per day carries the milk processed and that day's shared costs
-- (coal, electricity, labour, transport...). Those costs divided by the milk
-- processed give the day's conversion cost per litre - replacing the standing
-- 3.56/L assumption with what the plant actually spent.
--
-- Product-specific costs (raw material, packing) stay on the product; the day
-- only supplies the shared rate and the quantities produced.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Cost heads the plant spends on daily. Add or remove freely.
-- ---------------------------------------------------------------------
create table overhead_head (
  id           uuid primary key default gen_random_uuid(),
  scenario_id  uuid not null references scenario(id) on delete cascade,
  code         text not null,
  label        text not null,
  unit         text,                        -- kg, units, hours, trips...
  is_active    boolean not null default true,
  notes        text,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (scenario_id, code),
  constraint overhead_head_code_slug check (code ~ '^[a-z][a-z0-9_]*$')
);

-- ---------------------------------------------------------------------
-- A day of production.
-- ---------------------------------------------------------------------
create table production_day (
  id                uuid primary key default gen_random_uuid(),
  scenario_id       uuid not null references scenario(id) on delete cascade,
  day               date not null,
  milk_processed_l  numeric(20, 4),         -- the divisor for every shared cost
  status            text not null default 'open' check (status in ('open', 'closed')),
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (scenario_id, day)
);

-- ---------------------------------------------------------------------
-- What each head cost that day. Enter an amount directly, or a quantity and
-- a rate (450 kg coal at 9.20) and the amount follows.
-- ---------------------------------------------------------------------
create table daily_overhead (
  id       uuid primary key default gen_random_uuid(),
  day_id   uuid not null references production_day(id) on delete cascade,
  head_id  uuid not null references overhead_head(id) on delete cascade,
  qty      numeric(20, 4),
  rate     numeric(20, 4),
  amount   numeric(20, 4),
  notes    text,
  unique (day_id, head_id)
);

-- ---------------------------------------------------------------------
-- What was produced that day, per product.
-- ---------------------------------------------------------------------
create table daily_production (
  id            uuid primary key default gen_random_uuid(),
  day_id        uuid not null references production_day(id) on delete cascade,
  product_id    uuid not null references cost_object(id) on delete cascade,
  qty_produced  numeric(20, 4) not null default 0,
  notes         text,
  unique (day_id, product_id)
);

-- ---------------------------------------------------------------------
-- Raw material actually drawn for a product that day. Pre-filled from the
-- product's recipe, editable when the floor used something different.
-- ---------------------------------------------------------------------
create table daily_material_use (
  id           uuid primary key default gen_random_uuid(),
  day_id       uuid not null references production_day(id) on delete cascade,
  product_id   uuid not null references cost_object(id) on delete cascade,
  material_id  uuid references cost_object(id) on delete restrict,
  label        text,
  qty          numeric(20, 6),
  rate         numeric(20, 6),
  amount       numeric(20, 4),
  unique (day_id, product_id, material_id)
);

-- ---------------------------------------------------------------------
-- The frozen result: what each product cost on that day. Written when the day
-- is calculated, so later rate changes never rewrite history.
-- ---------------------------------------------------------------------
create table daily_product_cost (
  id                    uuid primary key default gen_random_uuid(),
  day_id                uuid not null references production_day(id) on delete cascade,
  product_id            uuid not null references cost_object(id) on delete cascade,
  qty_produced          numeric(20, 4),
  pack_size             numeric(20, 6),     -- litres or kg in one piece
  milk_qty_per_unit     numeric(20, 6),     -- litres of milk in one piece
  milk_rate             numeric(20, 6),     -- purchase + commission + procurement transport
  conversion_rate       numeric(20, 6),     -- the day's shared cost per litre
  material_cost         numeric(20, 6),     -- milk at purchase rate, per piece
  conversion_cost       numeric(20, 6),     -- shared cost carried by this piece
  packing_cost          numeric(20, 6),
  other_cost            numeric(20, 6),     -- additives and anything else
  unit_cost             numeric(20, 6),     -- ex-plant, per piece
  cost_per_kg           numeric(20, 6),     -- ex-plant, per kg or litre of product
  market_transport      numeric(20, 6),     -- per piece, to get it to market
  landed_unit_cost      numeric(20, 6),     -- unit_cost + market transport
  landed_per_kg         numeric(20, 6),
  total_cost            numeric(20, 4),     -- unit_cost x qty_produced
  computed_at           timestamptz not null default now(),
  unique (day_id, product_id)
);

create index on production_day (scenario_id, day desc);
create index on daily_overhead (day_id);
create index on daily_production (day_id);
create index on daily_material_use (day_id, product_id);
create index on daily_product_cost (day_id);
create index on daily_product_cost (product_id);

do $$
declare t text;
begin
  foreach t in array array['overhead_head', 'production_day']
  loop
    execute format(
      'create trigger %1$s_touch before update on %1$s
         for each row execute function touch_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- One row per day: milk processed, what the shared costs came to, and the
-- per-litre rate everything else is costed on.
-- ---------------------------------------------------------------------
create view v_daily_summary as
select
  d.id                                as day_id,
  d.scenario_id,
  d.day,
  d.status,
  d.milk_processed_l,
  coalesce(o.total_overhead, 0)       as total_overhead,
  case
    when coalesce(d.milk_processed_l, 0) > 0
      then coalesce(o.total_overhead, 0) / d.milk_processed_l
  end                                 as conversion_rate,
  coalesce(p.products_made, 0)        as products_made,
  coalesce(c.total_production_cost, 0) as total_production_cost,
  case
    when coalesce(d.milk_processed_l, 0) > 0
      then coalesce(c.total_production_cost, 0) / d.milk_processed_l
  end                                 as cost_per_litre
from production_day d
left join lateral (
  select sum(amount) as total_overhead from daily_overhead where day_id = d.id
) o on true
left join lateral (
  select count(*) as products_made from daily_production
   where day_id = d.id and qty_produced > 0
) p on true
left join lateral (
  select sum(total_cost) as total_production_cost from daily_product_cost where day_id = d.id
) c on true;
