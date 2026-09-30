-- =====================================================================
-- Which transporter brings each farmer's milk to the plant
--
-- A milk-to-plant transporter's cost for a day (v_transport_run) is shared
-- among the farmers it carries, in proportion to the litres each supplied
-- that day - so a farmer's transport cost follows their milk. One current
-- transporter per farmer; changing it re-divides every day by the new
-- assignment.
-- =====================================================================

create table farmer_transporter (
  scenario_id     uuid not null references scenario(id) on delete cascade,
  center          text not null,
  farmer_code     text not null,
  transporter_id  uuid not null references transporter(id) on delete cascade,
  updated_at      timestamptz not null default now(),
  primary key (scenario_id, center, farmer_code)
);

create index on farmer_transporter (transporter_id);

-- ---------------------------------------------------------------------
-- Each farmer's share of their transporter's cost, one row per day they
-- supplied milk: the transporter's day cost x (farmer litres / all litres
-- the transporter carried that day from its farmers). A day the
-- transporter didn't run, or has no cost yet, shares nothing.
-- ---------------------------------------------------------------------
create view v_farmer_transport_day as
with farmer_day as (
  select ft.scenario_id, c.center, c.farmer_code, ft.transporter_id, c.day,
         sum(c.qty_litre) as litres
    from vamaa_collection c
    join farmer_transporter ft on ft.center = c.center and ft.farmer_code = c.farmer_code
   group by ft.scenario_id, c.center, c.farmer_code, ft.transporter_id, c.day
),
carried as (
  select scenario_id, transporter_id, day, sum(litres) as litres
    from farmer_day
   group by scenario_id, transporter_id, day
),
day_cost as (
  select scenario_id, transporter_id, run_date as day, sum(cost) as cost
    from v_transport_run
   group by scenario_id, transporter_id, run_date
)
select f.scenario_id, f.center, f.farmer_code, f.transporter_id, f.day, f.litres,
       k.litres as transporter_litres,
       dc.cost  as transporter_cost,
       dc.cost * f.litres / nullif(k.litres, 0) as cost
  from farmer_day f
  join carried k using (scenario_id, transporter_id, day)
  left join day_cost dc using (scenario_id, transporter_id, day);
