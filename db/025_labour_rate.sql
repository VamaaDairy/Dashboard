-- =====================================================================
-- Labour rates as a history
--
-- What one labourer is paid for a day in each section. Like the electricity
-- price, each set of rates applies from its date until the next, so changing
-- them never rewrites earlier days. Starts at: day 300, special day 350,
-- night 300, contract 400.
-- =====================================================================

create table if not exists labour_rate (
  id              uuid primary key default gen_random_uuid(),
  scenario_id     uuid not null references scenario(id) on delete cascade,
  effective_from  date not null,
  day_regular     numeric(20, 2) not null check (day_regular >= 0),
  day_special     numeric(20, 2) not null check (day_special >= 0),
  night           numeric(20, 2) not null check (night >= 0),
  contract        numeric(20, 2) not null check (contract >= 0),
  created_at      timestamptz not null default now(),
  unique (scenario_id, effective_from)
);

insert into labour_rate (scenario_id, effective_from, day_regular, day_special, night, contract)
select s.id, date '2000-01-01', 300, 350, 300, 400 from scenario s
on conflict (scenario_id, effective_from) do nothing;
