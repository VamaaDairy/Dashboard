-- =====================================================================
-- Electricity meter readings, taken each morning (about 6:45)
--
-- The day's units are worked out from them: tomorrow's kWh reading minus
-- today's, divided by 10, times the meter multiplier (600) - see
-- src/lib/daily/meter.ts. The result is saved as that day's electricity
-- units, so costing is unchanged.
-- =====================================================================

create table electricity_reading (
  id           uuid primary key default gen_random_uuid(),
  scenario_id  uuid not null references scenario(id) on delete cascade,
  day          date not null,
  kwh          numeric(14, 2) not null check (kwh >= 0),   -- cumulative kWh reading
  kvarh        numeric(14, 2),                              -- cumulative kVArh reading
  kva          numeric(10, 3),                              -- maximum demand
  kvah         numeric(14, 2),                              -- cumulative kVAh reading
  pf           numeric(6, 3),                               -- power factor
  created_at   timestamptz not null default now(),
  unique (scenario_id, day)
);
