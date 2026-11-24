-- D2C orders only from Raipur and up to 5 km around it (src/lib/shop/area.ts). What Ola Maps says a spot's locality
-- is, kept per ~100 m square so the same area is not asked twice.
create table if not exists geo_locality (
  cell       text primary key,            -- latitude,longitude to 3 decimals
  locality   text not null,               -- Ola's locality there ('' = none)
  checked_at timestamptz not null default now()
);
