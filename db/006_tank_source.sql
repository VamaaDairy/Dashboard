-- =====================================================================
-- Where milk put into a tank came from
--
-- Collections on the Milk in page (fetched live from the Vamaa app) are put
-- into a tank by picking the tank on the collection's row. That creates an
-- ordinary 'in' movement carrying the collection's litres, fat, SNF and cost,
-- tagged with `source` and `source_ref` so the row knows which tank it went
-- to, and so one collection can only ever be in one tank at a time.
-- Hand-entered movements leave both null.
-- =====================================================================

alter table tank_movement
  add column source      text,
  add column source_ref  text;

create unique index tank_movement_source_ref_key
  on tank_movement (scenario_id, source_ref)
  where source_ref is not null;
