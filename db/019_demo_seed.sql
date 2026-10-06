-- =====================================================================
-- What the demo-data script put in, so it can be taken out again
--
-- `npm run db:seed:demo` fills 1-6 Oct end to end (tanks, batches, SKU
-- packing, transport, fuel, electricity, labour) and records here every row
-- it inserted and, for every row it changed, the values it replaced.
-- `npm run db:seed:demo -- --undo` deletes those rows, puts the old values
-- back and re-costs the days. Nothing else in the database is touched.
-- =====================================================================

create table demo_seed (
  id          bigserial primary key,
  tbl         text not null,            -- the table the row is in
  row_id      uuid not null,            -- its id
  old         jsonb,                    -- null = inserted by the seed; else the columns it overwrote
  created_at  timestamptz not null default now()
);

create index on demo_seed (tbl);
