-- =====================================================================
-- Fuel burned in the plant
--
-- Coal for the boiler, and anything else the plant burns (firewood, diesel
-- for the generator...). Each day records only how much of each was used.
-- What a unit costs is a price history per fuel: a price applies from its
-- `effective_from` date until the next one, so changing a price never
-- rewrites the days before it - they stay at the price in force then.
--
-- The day's total goes into the production day's "Fuel - Production in
-- plant" cost (overhead head fuel_production), so it is spread over what was
-- made that day like every other shared cost.
--
-- A fuel no longer used is marked inactive rather than deleted, so the days
-- it was used keep their records.
-- =====================================================================

create table plant_fuel (
  id           uuid primary key default gen_random_uuid(),
  scenario_id  uuid not null references scenario(id) on delete cascade,
  code         text not null,
  name         text not null,
  unit         text not null default 'kg',
  is_active    boolean not null default true,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  unique (scenario_id, code),
  constraint plant_fuel_code_slug check (code ~ '^[a-z][a-z0-9_]*$')
);

-- What a unit of a fuel costs, from each date on. The first price of a fuel
-- is dated 2000-01-01, meaning "from the start".
create table plant_fuel_rate (
  id              uuid primary key default gen_random_uuid(),
  fuel_id         uuid not null references plant_fuel(id) on delete cascade,
  effective_from  date not null,
  rate            numeric(20, 4) not null check (rate >= 0),   -- ₹ per unit
  created_at      timestamptz not null default now(),
  unique (fuel_id, effective_from)
);

-- One fuel on one day: how much was burned. Its cost is qty x the price in force that day.
create table plant_fuel_day (
  id           uuid primary key default gen_random_uuid(),
  scenario_id  uuid not null references scenario(id) on delete cascade,
  fuel_id      uuid not null references plant_fuel(id) on delete cascade,
  day          date not null,
  qty          numeric(20, 3) not null check (qty >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (fuel_id, day)
);

create index on plant_fuel_day (scenario_id, day desc);

create trigger plant_fuel_day_touch before update on plant_fuel_day
  for each row execute function touch_updated_at();

-- Each day's fuel with the price in force on that day, and its cost.
create view v_plant_fuel_day as
select d.id, d.scenario_id, d.fuel_id, d.day, d.qty, r.rate, r.effective_from as rate_from,
       d.qty * r.rate as cost
  from plant_fuel_day d
  left join lateral (
    select x.rate, x.effective_from from plant_fuel_rate x
     where x.fuel_id = d.fuel_id and x.effective_from <= d.day
     order by x.effective_from desc limit 1
  ) r on true;

-- Coal is the plant's main fuel, so every scenario starts with it, at ₹6/kg from the start.
insert into plant_fuel (scenario_id, code, name, unit, sort_order)
select s.id, 'coal', 'Coal', 'kg', 1 from scenario s
 where not exists (select 1 from plant_fuel f where f.scenario_id = s.id and f.code = 'coal');

insert into plant_fuel_rate (fuel_id, effective_from, rate)
select f.id, date '2000-01-01', 6 from plant_fuel f
 where f.code = 'coal' and not exists (select 1 from plant_fuel_rate r where r.fuel_id = f.id);
