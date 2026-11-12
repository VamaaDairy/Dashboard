-- Lab test of the milk taken out of the tanks for production (Production page > a product's milk).
--
-- Optional FAT %, SNF % and CLR as measured when the milk is drawn, one record per batch and tank. Kept apart
-- from the tank's own blend: the fat / SNF on tank_movement and bulk_batch (which drive kg, cost and the tank
-- ledger) are never changed by a test. Removing the draw from the batch, or the batch itself, removes its test.

create table if not exists production_milk_test (
  id          uuid primary key default gen_random_uuid(),
  batch_id    uuid not null references bulk_batch(id) on delete cascade,
  tank_id     uuid not null references tank(id) on delete cascade,
  fat_pct     numeric(6, 3) check (fat_pct between 0 and 20),
  snf_pct     numeric(6, 3) check (snf_pct between 0 and 20),
  clr         numeric(6, 2) check (clr between 0 and 40),
  entered_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (batch_id, tank_id),
  check (fat_pct is not null or snf_pct is not null or clr is not null)
);

create index if not exists production_milk_test_batch_ix on production_milk_test (batch_id);
