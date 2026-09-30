-- =====================================================================
-- Transporters, their rates, and what they run each day
--
-- Who moves milk for the plant, split by which leg of the journey they run:
--
--   milk_to_plant - bringing milk in: farmers' direct milk from the villages,
--                   and the plant's own transport fetching AB Dairy and Sai
--                   Dairy milk together.
--   delivery      - taking finished goods out of the plant to market.
--
-- A transporter is paid one of three ways, and that can change over time:
--
--   per_km   - `rate` rupees per km, so a day costs km x rate.
--   per_trip - a fixed `rate` per trip (a round trip counts as one),
--              so a day costs trips x rate.
--   diesel   - the plant buys the diesel, so a day costs the litres used x
--              the diesel price that day (`diesel_price`). No `rate`.
--
-- Rates and the diesel price are kept as a history: each row applies from
-- `effective_from` until the next one starts. A day is always costed at the
-- rate in force on that day, so adding a new rate never rewrites what earlier
-- days cost.
--
-- A transporter that stops working for the plant is marked inactive rather
-- than deleted, so its history keeps its name.
-- =====================================================================

create table transporter (
  id                     uuid primary key default gen_random_uuid(),
  scenario_id            uuid not null references scenario(id) on delete cascade,
  section                text not null check (section in ('milk_to_plant', 'delivery')),
  code                   text not null,
  name                   text not null,
  -- the usual day, used to pre-fill the day entry before the transporter has any runs
  distance_km            numeric(20, 2),
  trips_per_day          numeric(20, 2),
  diesel_litre_per_day   numeric(20, 2),
  is_active              boolean not null default true,
  notes                  text,
  sort_order             int not null default 0,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  -- the same company can run both legs, so a name is unique within a section only
  unique (scenario_id, section, code),
  constraint transporter_code_slug check (code ~ '^[a-z][a-z0-9_]*$')
);

create table transporter_rate (
  id              uuid primary key default gen_random_uuid(),
  scenario_id     uuid not null references scenario(id) on delete cascade,
  transporter_id  uuid not null references transporter(id) on delete cascade,
  effective_from  date not null,
  cost_basis      text not null check (cost_basis in ('per_km', 'per_trip', 'diesel')),
  rate            numeric(20, 4) check (rate >= 0),   -- ₹ per km or ₹ per trip; none for diesel
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (transporter_id, effective_from),
  constraint transporter_rate_needs_rate check (cost_basis = 'diesel' or rate is not null)
);

-- What a litre of diesel costs the plant, from each date on.
create table diesel_price (
  id               uuid primary key default gen_random_uuid(),
  scenario_id      uuid not null references scenario(id) on delete cascade,
  effective_from   date not null,
  price_per_litre  numeric(20, 4) not null check (price_per_litre >= 0),
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (scenario_id, effective_from)
);

-- One transporter's work on one day: km, trips or diesel litres, by how it is paid.
create table transport_run (
  id              uuid primary key default gen_random_uuid(),
  scenario_id     uuid not null references scenario(id) on delete cascade,
  transporter_id  uuid not null references transporter(id) on delete cascade,
  run_date        date not null,
  distance_km     numeric(20, 2),
  trips           numeric(20, 2),
  diesel_litre    numeric(20, 2),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (transporter_id, run_date)
);

create index on transporter (scenario_id, section, sort_order);
create index on transport_run (scenario_id, run_date desc);

do $$
declare t text;
begin
  foreach t in array array['transporter', 'transporter_rate', 'diesel_price', 'transport_run']
  loop
    execute format(
      'create trigger %1$s_touch before update on %1$s
         for each row execute function touch_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Each run with the rate (or diesel price) in force on its day, and what the
-- day cost. `cost` is null when there is no rate yet for that day, or the run
-- is missing the km, trips or litres its rate is charged on.
-- ---------------------------------------------------------------------
create view v_transport_run as
select
  r.id              as run_id,
  r.scenario_id,
  t.section,
  r.transporter_id,
  t.name            as transporter_name,
  r.run_date,
  r.distance_km,
  r.trips,
  r.diesel_litre,
  rt.cost_basis,
  case when rt.cost_basis = 'diesel' then dp.price_per_litre else rt.rate end as rate,
  rt.effective_from as rate_from,
  case
    when rt.cost_basis = 'per_km'   then r.distance_km * rt.rate
    when rt.cost_basis = 'per_trip' then r.trips * rt.rate
    when rt.cost_basis = 'diesel'   then r.diesel_litre * dp.price_per_litre
  end               as cost
from transport_run r
join transporter t on t.id = r.transporter_id
left join lateral (
  select x.cost_basis, x.rate, x.effective_from
    from transporter_rate x
   where x.transporter_id = r.transporter_id
     and x.effective_from <= r.run_date
   order by x.effective_from desc
   limit 1
) rt on true
left join lateral (
  select p.price_per_litre
    from diesel_price p
   where p.scenario_id = r.scenario_id
     and p.effective_from <= r.run_date
   order by p.effective_from desc
   limit 1
) dp on true;
