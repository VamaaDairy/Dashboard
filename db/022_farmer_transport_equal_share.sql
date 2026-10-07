-- =====================================================================
-- Milk-to-plant transport is shared equally among the farmers carried
--
-- A transporter's cost for a day is now divided equally among the farmers
-- whose milk it brought that day: 5 farmers on the route -> each carries
-- cost / 5, whatever litres they supplied. (It was shared by litres before.)
-- A farmer counts on a day only if they supplied milk that day. A day the
-- transporter didn't run, or has no cost yet, shares nothing.
--
-- Same columns as before, plus transporter_farmers - how many farmers the
-- day's cost was split over.
-- =====================================================================

create or replace view v_farmer_transport_day as
with farmer_day as (
  select ft.scenario_id, c.center, c.farmer_code, ft.transporter_id, c.day,
         sum(c.qty_litre) as litres
    from vamaa_collection c
    join farmer_transporter ft on ft.center = c.center and ft.farmer_code = c.farmer_code
   group by ft.scenario_id, c.center, c.farmer_code, ft.transporter_id, c.day
  having sum(c.qty_litre) > 0
),
carried as (
  select scenario_id, transporter_id, day, sum(litres) as litres, count(*) as farmers
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
       dc.cost / nullif(k.farmers, 0) as cost,
       k.farmers::int as transporter_farmers
  from farmer_day f
  join carried k using (scenario_id, transporter_id, day)
  left join day_cost dc using (scenario_id, transporter_id, day);
