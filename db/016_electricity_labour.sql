-- =====================================================================
-- Electricity and labour, entered day by day
--
-- Electricity: the units used that day; the cost is units x the price per
-- unit in force that day. The price is a history like plant fuel's - each
-- price applies from its date until the next, so changing it never rewrites
-- earlier days. It starts at ₹14 a unit.
--
-- Labour: how many labourers worked that day and what they were paid in all.
--
-- Both land in the day's daily_overhead row for their head (qty = units or
-- labourers, rate = ₹ per unit or per labourer, amount = the day's cost), so
-- they are spread over that day's production like every other shared cost.
-- =====================================================================

create table electricity_rate (
  id              uuid primary key default gen_random_uuid(),
  scenario_id     uuid not null references scenario(id) on delete cascade,
  effective_from  date not null,
  rate            numeric(20, 4) not null check (rate >= 0),   -- ₹ per unit (kWh)
  created_at      timestamptz not null default now(),
  unique (scenario_id, effective_from)
);

insert into electricity_rate (scenario_id, effective_from, rate)
select s.id, date '2000-01-01', 14 from scenario s
on conflict (scenario_id, effective_from) do nothing;

-- labour is counted in labourers now, not hours
update overhead_head set unit = 'labourers' where code = 'labour';
