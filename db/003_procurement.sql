-- =====================================================================
-- Milk procurement
--
-- What a litre of milk actually costs by the time it is standing in the
-- plant's silo. Three things add up to that number:
--
--   1. Price to the farmer  - paid on the SOLIDS in the milk (fat and SNF),
--                             not on the volume. The container is weighed, so
--                             the honest quantity is kilograms; litres are a
--                             derived, presentational figure.
--   2. Sachiv commission    - what the village secretary earns for collecting.
--   3. Tanker cost          - what it cost to move that milk to the plant,
--                             spread over the milk the tanker actually carried.
--
-- Volume and weight are interchangeable everywhere through one editable
-- assumption: 1 litre of milk = 1.03 kg (parameter `milk_kg_per_litre`).
-- =====================================================================

-- ---------------------------------------------------------------------
-- The litre <-> kilogram bridge. A function rather than a constant so the
-- assumption stays a single editable row, the way every other number here is.
-- ---------------------------------------------------------------------
create or replace function milk_kg_per_litre(p_scenario uuid) returns numeric as $$
  select coalesce(
    (select value_num from parameter
      where scenario_id = p_scenario
        and key = 'milk_kg_per_litre'
        and value_num is not null
        and value_num > 0
      limit 1),
    1.03);
$$ language sql stable;

insert into parameter (scenario_id, key, label, group_name, value_num, decimals, suffix, description, sort_order)
select s.id, 'milk_kg_per_litre', 'Milk density (kg per litre)', 'Procurement',
       1.03, 4, 'kg/L',
       'One litre of milk weighs this much. Used everywhere the portal converts litres to kilograms and back.',
       0
  from scenario s
 where not exists (
   select 1 from parameter p where p.scenario_id = s.id and p.key = 'milk_kg_per_litre');

-- ---------------------------------------------------------------------
-- MODULE 1 - price to the farmer
--
-- A rate chart says how milk is valued. The usual basis here is rupees per
-- kilogram of total solids: weigh the milk, test it, and pay for the fat and
-- SNF it carries. The other bases exist because societies price differently -
-- separate fat and SNF rates, fat only, or (rarely) a flat rate on quantity.
-- ---------------------------------------------------------------------
create table milk_rate_chart (
  id              uuid primary key default gen_random_uuid(),
  scenario_id     uuid not null references scenario(id) on delete cascade,
  code            text not null,
  name            text not null,
  milk_type       text not null default 'mixed'
                    check (milk_type in ('cow', 'buffalo', 'mixed')),
  basis           text not null default 'solids'
                    check (basis in ('solids', 'fat_snf', 'fat_only', 'per_kg', 'per_litre')),
  rate_solid      numeric(20, 4),   -- basis 'solids'    - Rs per kg of (fat + SNF)
  rate_fat        numeric(20, 4),   -- basis 'fat_snf' / 'fat_only' - Rs per kg fat
  rate_snf        numeric(20, 4),   -- basis 'fat_snf'   - Rs per kg SNF
  flat_rate       numeric(20, 4),   -- basis 'per_kg' / 'per_litre'
  effective_from  date not null default current_date,
  is_active       boolean not null default true,
  notes           text,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (scenario_id, code),
  constraint milk_rate_chart_code_slug check (code ~ '^[a-z][a-z0-9_]*$')
);

-- ---------------------------------------------------------------------
-- MODULE 3 - the collection centre and its sachiv
--
-- Milk is collected at a village society. The sachiv who runs it is paid a
-- commission: per kilogram, per litre, or as a share of what the farmers were
-- paid. The mode is per centre because societies negotiate separately.
-- ---------------------------------------------------------------------
create table procurement_center (
  id               uuid primary key default gen_random_uuid(),
  scenario_id      uuid not null references scenario(id) on delete cascade,
  code             text not null,
  name             text not null,
  sachiv_name      text,
  village          text,
  route            text,
  distance_km      numeric(20, 2),
  rate_chart_id    uuid references milk_rate_chart(id) on delete set null,
  commission_mode  text not null default 'per_kg'
                     check (commission_mode in ('per_kg', 'per_litre', 'pct_of_value', 'none')),
  commission_rate  numeric(20, 4),  -- Rs/kg, Rs/L, or a percentage (4 = 4%)
  is_active        boolean not null default true,
  notes            text,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (scenario_id, code),
  constraint procurement_center_code_slug check (code ~ '^[a-z][a-z0-9_]*$')
);

-- ---------------------------------------------------------------------
-- MODULE 2 - the tanker run that brings the milk in
--
-- Hire is quoted per trip, per kilometre, or on the quantity carried. The cost
-- is then spread over the collections loaded onto that tanker, pro rata on
-- weight. `received_qty_kg` is the dock weight at the plant: anything missing
-- against what was loaded is transit shortage, and the milk that did arrive
-- has to carry the whole cost.
-- ---------------------------------------------------------------------
create table tanker_trip (
  id               uuid primary key default gen_random_uuid(),
  scenario_id      uuid not null references scenario(id) on delete cascade,
  trip_date        date not null,
  tanker_code      text not null,
  vehicle_no       text,
  route            text,
  distance_km      numeric(20, 2),
  cost_mode        text not null default 'per_trip'
                     check (cost_mode in ('per_trip', 'per_km', 'per_kg', 'per_litre')),
  rate             numeric(20, 4),
  other_cost       numeric(20, 4) not null default 0,  -- tolls, cleaning, loading
  cost_override    numeric(20, 4),                     -- an actual bill beats the formula
  received_qty_kg  numeric(20, 4),                     -- dock weight; null = no shortage
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- One collection: what a centre handed over in one shift.
--
-- `qty_kg` is the weight in the container - that is what we take delivery of.
-- Everything derived from the rate chart and the centre's commission terms is
-- written here at save time, so a later change to a chart never silently
-- rewrites what was already paid.
-- ---------------------------------------------------------------------
create table procurement_batch (
  id                 uuid primary key default gen_random_uuid(),
  scenario_id        uuid not null references scenario(id) on delete cascade,
  center_id          uuid not null references procurement_center(id) on delete cascade,
  rate_chart_id      uuid not null references milk_rate_chart(id) on delete restrict,
  trip_id            uuid references tanker_trip(id) on delete set null,
  collected_on       date not null,
  shift              text not null default 'morning'
                       check (shift in ('morning', 'evening')),

  qty_kg             numeric(20, 4) not null,   -- weighed, and what we pay against
  fat_pct            numeric(20, 4),
  snf_pct            numeric(20, 4),

  -- derived at save time
  qty_litre          numeric(20, 4),
  kg_fat             numeric(20, 6),
  kg_snf             numeric(20, 6),
  kg_solids          numeric(20, 6),
  farmer_amount      numeric(20, 4),
  commission_amount  numeric(20, 4),
  farmer_rate_per_kg numeric(20, 6),            -- farmer_amount / qty_kg

  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (scenario_id, center_id, collected_on, shift)
);

create index on milk_rate_chart (scenario_id, sort_order);
create index on procurement_center (scenario_id, sort_order);
create index on tanker_trip (scenario_id, trip_date desc);
create index on procurement_batch (scenario_id, collected_on desc);
create index on procurement_batch (center_id);
create index on procurement_batch (trip_id);
create index on procurement_batch (rate_chart_id);

do $$
declare t text;
begin
  foreach t in array array['milk_rate_chart', 'procurement_center',
                           'tanker_trip', 'procurement_batch']
  loop
    execute format(
      'create trigger %1$s_touch before update on %1$s
         for each row execute function touch_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- A tanker run with its load and its true cost per kilogram landed.
-- ---------------------------------------------------------------------
create view v_tanker_trip as
select
  t.id                                        as trip_id,
  t.scenario_id,
  t.trip_date,
  t.tanker_code,
  t.vehicle_no,
  t.route,
  t.distance_km,
  t.cost_mode,
  t.rate,
  t.other_cost,
  t.cost_override,
  t.notes,
  l.batch_count,
  l.dispatched_kg,
  l.dispatched_kg / milk_kg_per_litre(t.scenario_id)      as dispatched_litre,
  coalesce(t.received_qty_kg, l.dispatched_kg)            as landed_kg,
  coalesce(t.received_qty_kg, l.dispatched_kg)
    / milk_kg_per_litre(t.scenario_id)                    as landed_litre,
  l.dispatched_kg - coalesce(t.received_qty_kg, l.dispatched_kg) as shortage_kg,
  c.trip_cost,
  c.trip_cost / nullif(coalesce(t.received_qty_kg, l.dispatched_kg), 0) as cost_per_kg,
  c.trip_cost / nullif(coalesce(t.received_qty_kg, l.dispatched_kg), 0)
    * milk_kg_per_litre(t.scenario_id)                    as cost_per_litre
from tanker_trip t
left join lateral (
  select
    count(*)                    as batch_count,
    coalesce(sum(qty_kg), 0)    as dispatched_kg
  from procurement_batch b where b.trip_id = t.id
) l on true
left join lateral (
  select coalesce(
    t.cost_override,
    case t.cost_mode
      when 'per_trip'  then coalesce(t.rate, 0)
      when 'per_km'    then coalesce(t.rate, 0) * coalesce(t.distance_km, 0)
      when 'per_kg'    then coalesce(t.rate, 0) * l.dispatched_kg
      when 'per_litre' then coalesce(t.rate, 0) * l.dispatched_kg
                              / milk_kg_per_litre(t.scenario_id)
    end + t.other_cost
  ) as trip_cost
) c on true;

-- ---------------------------------------------------------------------
-- One collection costed all the way to the plant gate.
--
-- The tanker's cost is shared out on weight loaded; transit shortage is
-- applied the same way, so the milk that survived the journey carries the
-- cost of the milk that did not.
-- ---------------------------------------------------------------------
create view v_procurement_batch as
select
  b.id                        as batch_id,
  b.scenario_id,
  b.collected_on,
  b.shift,
  b.center_id,
  ct.code                     as center_code,
  ct.name                     as center_name,
  ct.sachiv_name,
  ct.village,
  ct.route,
  b.rate_chart_id,
  rc.code                     as chart_code,
  rc.name                     as chart_name,
  rc.basis                    as chart_basis,
  rc.milk_type,
  b.trip_id,
  tr.tanker_code,
  b.qty_kg,
  b.qty_litre,
  b.fat_pct,
  b.snf_pct,
  b.kg_fat,
  b.kg_snf,
  b.kg_solids,
  b.farmer_amount,
  b.farmer_rate_per_kg,
  b.commission_amount,
  b.notes,
  coalesce(tr.trip_cost * b.qty_kg / nullif(tr.dispatched_kg, 0), 0)  as transport_amount,
  b.qty_kg * coalesce(tr.landed_kg / nullif(tr.dispatched_kg, 0), 1)  as landed_kg,
  b.qty_kg * coalesce(tr.landed_kg / nullif(tr.dispatched_kg, 0), 1)
    / milk_kg_per_litre(b.scenario_id)                                as landed_litre,
  coalesce(b.farmer_amount, 0) + coalesce(b.commission_amount, 0)
    + coalesce(tr.trip_cost * b.qty_kg / nullif(tr.dispatched_kg, 0), 0) as total_cost,
  (coalesce(b.farmer_amount, 0) + coalesce(b.commission_amount, 0)
    + coalesce(tr.trip_cost * b.qty_kg / nullif(tr.dispatched_kg, 0), 0))
    / nullif(b.qty_kg * coalesce(tr.landed_kg / nullif(tr.dispatched_kg, 0), 1), 0)
                                                                      as landed_per_kg,
  (coalesce(b.farmer_amount, 0) + coalesce(b.commission_amount, 0)
    + coalesce(tr.trip_cost * b.qty_kg / nullif(tr.dispatched_kg, 0), 0))
    / nullif(b.qty_kg * coalesce(tr.landed_kg / nullif(tr.dispatched_kg, 0), 1), 0)
    * milk_kg_per_litre(b.scenario_id)                                as landed_per_litre
from procurement_batch b
join procurement_center ct on ct.id = b.center_id
join milk_rate_chart rc    on rc.id = b.rate_chart_id
left join v_tanker_trip tr on tr.trip_id = b.trip_id;

-- ---------------------------------------------------------------------
-- A day's procurement in one row: how much came in, what the three cost
-- blocks came to, and the landed rate everything downstream is costed on.
-- ---------------------------------------------------------------------
create view v_procurement_day as
select
  scenario_id,
  collected_on,
  count(*)                               as batch_count,
  count(distinct center_id)              as center_count,
  sum(qty_kg)                            as qty_kg,
  sum(qty_litre)                         as qty_litre,
  sum(landed_kg)                         as landed_kg,
  sum(landed_litre)                      as landed_litre,
  sum(kg_fat)                            as kg_fat,
  sum(kg_snf)                            as kg_snf,
  sum(kg_solids)                         as kg_solids,
  sum(kg_fat)   / nullif(sum(qty_kg), 0) * 100 as fat_pct,
  sum(kg_snf)   / nullif(sum(qty_kg), 0) * 100 as snf_pct,
  sum(farmer_amount)                     as farmer_amount,
  sum(commission_amount)                 as commission_amount,
  sum(transport_amount)                  as transport_amount,
  sum(total_cost)                        as total_cost,
  sum(total_cost) / nullif(sum(landed_kg), 0)    as landed_per_kg,
  sum(total_cost) / nullif(sum(landed_litre), 0) as landed_per_litre,
  sum(total_cost) / nullif(sum(kg_solids), 0)    as landed_per_kg_solids
from v_procurement_batch
group by scenario_id, collected_on;

-- ---------------------------------------------------------------------
-- What each sachiv earned, and on what volume.
-- ---------------------------------------------------------------------
create view v_sachiv_commission as
select
  b.scenario_id,
  b.center_id,
  b.center_code,
  b.center_name,
  b.sachiv_name,
  min(b.collected_on)                    as first_collection,
  max(b.collected_on)                    as last_collection,
  count(*)                               as batch_count,
  sum(b.qty_kg)                          as qty_kg,
  sum(b.qty_litre)                       as qty_litre,
  sum(b.farmer_amount)                   as farmer_amount,
  sum(b.commission_amount)               as commission_amount,
  sum(b.commission_amount) / nullif(sum(b.qty_kg), 0)        as commission_per_kg,
  sum(b.commission_amount) / nullif(sum(b.qty_litre), 0)     as commission_per_litre,
  sum(b.commission_amount) / nullif(sum(b.farmer_amount), 0) * 100 as commission_pct_of_value
from v_procurement_batch b
group by b.scenario_id, b.center_id, b.center_code, b.center_name, b.sachiv_name;
