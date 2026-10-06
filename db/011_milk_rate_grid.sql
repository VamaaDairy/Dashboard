-- =====================================================================
-- The milk rate chart: rupees per litre by fat % and CLR
--
-- What the plant pays a farmer for a litre of milk, read off a grid of fat %
-- (rows, in 0.1 steps) against CLR (columns, in 0.5 steps). Charts get
-- revised, so each one applies from `effective_from` until the next starts,
-- and a collection is always priced on the chart in force on its day. The
-- first chart marks when prices start being calculated locally (1 Oct
-- 2026); before it, the prices the Vamaa app sent are kept as they were.
--
-- milk_chart_rate() looks a collection up: fat to the nearest 0.1 and CLR
-- to the nearest 0.5 (most readings already sit exactly on the grid). A
-- reading outside the chart - fat below 3 or above 10, CLR outside 23-30,
-- or a blank - has no rate rather than an invented one.
-- =====================================================================

create table milk_rate_grid (
  id              uuid primary key default gen_random_uuid(),
  scenario_id     uuid not null references scenario(id) on delete cascade,
  name            text not null,
  effective_from  date not null,
  notes           text,
  created_at      timestamptz not null default now(),
  unique (scenario_id, effective_from)
);

create table milk_rate_grid_cell (
  grid_id  uuid not null references milk_rate_grid(id) on delete cascade,
  fat      numeric(4, 1) not null,
  clr      numeric(4, 1) not null,
  rate     numeric(10, 2) not null check (rate >= 0),   -- ₹ per litre
  primary key (grid_id, fat, clr)
);

-- ₹ per litre for a collection with this fat and CLR on this day; null when
-- there's no chart yet or the reading is off the chart.
create or replace function milk_chart_rate(p_scenario uuid, p_day date, p_fat numeric, p_clr numeric)
returns numeric as $$
  select c.rate
    from (select g.id from milk_rate_grid g
           where g.scenario_id = p_scenario and g.effective_from <= p_day
           order by g.effective_from desc limit 1) g
    join milk_rate_grid_cell c
      on c.grid_id = g.id
     and c.fat = round(p_fat, 1)
     and c.clr = round(p_clr * 2) / 2;
$$ language sql stable;

-- ₹ per litre the plant pays for a collection. From the day the first chart
-- applies (1 Oct 2026), prices are calculated here from the chart - the app
-- no longer sends them. Before that, the price the app sent is kept exactly
-- as it was. Off-chart readings under a chart have no price.
create or replace function milk_price(p_scenario uuid, p_day date, p_fat numeric, p_clr numeric, p_app_rate numeric)
returns numeric as $$
  select case
    when exists (select 1 from milk_rate_grid g where g.scenario_id = p_scenario and g.effective_from <= p_day)
      then milk_chart_rate(p_scenario, p_day, p_fat, p_clr)
    else nullif(p_app_rate, 0)
  end;
$$ language sql stable;
