-- =====================================================================
-- A local copy of the Vamaa app's data: collections and farmers
--
-- Every page reads Vamaa data from here, never straight from the app; the
-- app is only called to fill in what isn't stored yet. Collections come one
-- day at a time, so each day is fetched once and kept; `vamaa_sync_day`
-- records when, so recent days (which do get corrected the next morning) can
-- be re-fetched while older ones are left alone. The farmer list is
-- refreshed at most hourly. Deleting these rows only means they're fetched
-- again.
-- =====================================================================

create table vamaa_sync_day (
  center       text not null,
  day          date not null,
  fetched_at   timestamptz not null default now(),
  row_count    int not null default 0,
  primary key (center, day)
);

create table vamaa_collection (
  id           uuid primary key default gen_random_uuid(),
  center       text not null,
  day          date not null,
  farmer_code  text not null,
  shift        text not null,              -- 'M' or 'E'
  milk_type    text,
  qty_litre    numeric(20, 4) not null default 0,
  fat_pct      numeric(20, 4),
  snf_pct      numeric(20, 4),             -- from CLR and fat, as Milk in shows it
  clr          numeric(20, 4),
  rate         numeric(20, 4),
  amount       numeric(20, 4),
  raw          jsonb not null,             -- the record exactly as the API sent it
  fetched_at   timestamptz not null default now()
);

create index on vamaa_collection (center, farmer_code, day);
create index on vamaa_collection (center, day);

-- The centre's registered farmers, exactly as the app lists them, plus the
-- few fields the portal searches and shows.
create table vamaa_farmer (
  center        text not null,
  code          text not null,
  unique_code   bigint,
  name          text,
  mobile        text,
  milk_type     text,
  status        int,
  created_on    text,
  raw           jsonb not null,
  fetched_at    timestamptz not null default now(),
  primary key (center, code)
);
