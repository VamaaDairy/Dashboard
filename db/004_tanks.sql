-- =====================================================================
-- Milk storage tanks
--
-- A tank holds milk from more than one source blended together. Add milk to
-- it and the tank's fat%, SNF% and cost per litre all move to a weighted
-- average of what was already there and what just went in - the same
-- moving-average an inventory ledger uses. Take milk out and the quantity
-- drops but the blend does not change - what leaves carries the tank's
-- current average, not a value of its own.
--
-- `tank_movement` is an append-only ledger. Every row freezes the tank's
-- balance immediately after that movement, so a later addition never
-- rewrites what an earlier one recorded. Editing or deleting a movement
-- replays the whole ledger in date order and rewrites every balance from
-- there - see `recomputeTank` in src/lib/tanks/engine.ts.
-- =====================================================================

create table tank (
  id              uuid primary key default gen_random_uuid(),
  scenario_id     uuid not null references scenario(id) on delete cascade,
  code            text not null,
  name            text not null,
  capacity_litre  numeric(20, 4),
  is_active       boolean not null default true,
  notes           text,
  sort_order      int not null default 0,

  -- live balance, kept in sync by every insert/delete against tank_movement
  qty_litre       numeric(20, 4) not null default 0,
  fat_pct         numeric(20, 4) not null default 0,
  snf_pct         numeric(20, 4) not null default 0,
  cost_per_litre  numeric(20, 4) not null default 0,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (scenario_id, code),
  constraint tank_code_slug check (code ~ '^[a-z][a-z0-9_]*$')
);

create table tank_movement (
  id              uuid primary key default gen_random_uuid(),
  scenario_id     uuid not null references scenario(id) on delete cascade,
  tank_id         uuid not null references tank(id) on delete cascade,
  movement_date   date not null,
  direction       text not null check (direction in ('in', 'out')),
  qty_litre       numeric(20, 4) not null check (qty_litre > 0),

  -- entered for 'in' (what's being added); for 'out' these are filled in by
  -- the engine at recompute time, as a copy of the balance just before it -
  -- what left the tank always carries the tank's own blend.
  fat_pct         numeric(20, 4),
  snf_pct         numeric(20, 4),
  cost_per_litre  numeric(20, 4),

  -- frozen tank balance immediately after this movement
  balance_litre          numeric(20, 4) not null default 0,
  balance_fat_pct         numeric(20, 4) not null default 0,
  balance_snf_pct         numeric(20, 4) not null default 0,
  balance_cost_per_litre  numeric(20, 4) not null default 0,

  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index on tank (scenario_id, sort_order);
create index on tank_movement (scenario_id, tank_id, movement_date, created_at);

do $$
declare t text;
begin
  foreach t in array array['tank', 'tank_movement']
  loop
    execute format(
      'create trigger %1$s_touch before update on %1$s
         for each row execute function touch_updated_at()', t);
  end loop;
end $$;
