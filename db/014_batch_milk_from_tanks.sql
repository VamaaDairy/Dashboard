-- =====================================================================
-- Milk for a bulk batch comes out of the tanks
--
-- A batch no longer has its milk typed in. On the Production page each
-- product picks one or more tanks and how many litres it took from each;
-- saving the day writes those as ordinary 'out' movements on the tanks,
-- tagged source = 'production' and linked to the batch. The tank engine
-- fills in the fat, SNF and ₹/L each left at (the tank's blend at that
-- point), and the batch's milk_litre / milk_fat_pct / milk_snf_pct /
-- milk_cost are the weighted average of its draws, copied back on save.
--
-- Deleting the batch removes its draws (the app recomputes those tanks).
-- =====================================================================

alter table tank_movement
  add column bulk_batch_id uuid references bulk_batch(id) on delete cascade;

create index on tank_movement (bulk_batch_id) where bulk_batch_id is not null;

-- what the batch's milk cost: Σ litres × ₹/L of each draw
alter table bulk_batch
  add column milk_cost numeric(20, 2);
