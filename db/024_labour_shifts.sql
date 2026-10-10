-- =====================================================================
-- Labour split into day, night and contract
--
-- How many people worked in each section on a day. The rates (day 300,
-- special day 350, night 300, contract 400) live in src/lib/daily/labour.ts;
-- the day's total still lands in daily_overhead's labour row, so costing is
-- unchanged. Days saved before this have a total but no split.
-- =====================================================================

create table if not exists labour_day (
  day_id        uuid primary key references production_day(id) on delete cascade,
  day_regular   integer not null default 0 check (day_regular >= 0),
  day_special   integer not null default 0 check (day_special >= 0),
  night         integer not null default 0 check (night >= 0),
  contract      integer not null default 0 check (contract >= 0)
);
