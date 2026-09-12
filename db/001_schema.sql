-- =====================================================================
-- Dynamic Costing ERP - core schema
--
-- Design rule: nothing about the cost model is hard-coded in the schema.
-- Classes of things, the columns each class has, the formulas behind each
-- column, the global parameters and the bill-of-material lines are all rows
-- that can be added, edited or removed at runtime. The only fixed columns are
-- identity/ordering ones.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- People (thin - used for audit attribution)
-- ---------------------------------------------------------------------
create table app_user (
  id             uuid primary key default gen_random_uuid(),
  email          text unique not null,
  name           text not null,
  role           text not null default 'editor'
                   check (role in ('owner', 'editor', 'viewer')),
  password_hash  text,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Scenario = one complete, versioned cost model (a "workbook")
-- Clone a scenario to run what-ifs without touching the live numbers.
-- ---------------------------------------------------------------------
create table scenario (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,
  name            text not null,
  description     text,
  effective_from  date not null default current_date,
  status          text not null default 'draft'
                    check (status in ('draft', 'active', 'archived')),
  currency        text not null default 'INR',
  cloned_from_id  uuid references scenario(id) on delete set null,
  created_by      uuid references app_user(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Units of measure (global, shared across scenarios)
-- ---------------------------------------------------------------------
create table uom (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,
  name            text not null,
  dimension       text not null
                    check (dimension in ('mass', 'volume', 'count', 'currency',
                                         'ratio', 'time', 'other')),
  factor_to_base  numeric(20, 10) not null default 1,
  base_code       text,
  sort_order      int not null default 0
);

-- ---------------------------------------------------------------------
-- Global parameters: every number that is "just a number" lives here so it
-- can be changed in one place and ripple everywhere (base milk rate, GST,
-- commission %, markup, transport rates, ...). A parameter may itself be a
-- formula over other parameters.
-- ---------------------------------------------------------------------
create table parameter (
  id            uuid primary key default gen_random_uuid(),
  scenario_id   uuid not null references scenario(id) on delete cascade,
  key           text not null,
  label         text not null,
  group_name    text not null default 'General',
  value_num     numeric(20, 8),
  formula       text,
  uom_id        uuid references uom(id) on delete set null,
  min_value     numeric(20, 8),
  max_value     numeric(20, 8),
  decimals      int not null default 4,
  suffix        text,
  description   text,
  is_locked     boolean not null default false,
  sort_order    int not null default 0,
  computed_num  numeric(20, 8),
  computed_at   timestamptz,
  error         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (scenario_id, key),
  constraint parameter_key_slug check (key ~ '^[a-z][a-z0-9_]*$')
);

-- ---------------------------------------------------------------------
-- Object classes: user-definable kinds of costable things.
-- Seeded with milk_batch / product / packaging / ingredient / recipe, but the
-- user can add e.g. "sweets" or "byproduct" without a migration.
-- ---------------------------------------------------------------------
create table object_class (
  id            uuid primary key default gen_random_uuid(),
  scenario_id   uuid not null references scenario(id) on delete cascade,
  code          text not null,
  name          text not null,
  plural_name   text,
  description   text,
  allows_bom    boolean not null default true,
  -- field key holding this class's unit cost; used as the default rate when an
  -- object of this class is consumed as a BOM component, and by the bare
  -- O.<code> shorthand in formulas
  cost_field    text,
  is_locked     boolean not null default false,
  color         text,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (scenario_id, code),
  constraint object_class_code_slug check (code ~ '^[a-z][a-z0-9_]*$')
);

-- ---------------------------------------------------------------------
-- Field groups: UI grouping + roll-up targets ("all fields in group
-- cost_component sum into total_cost").
-- ---------------------------------------------------------------------
create table field_group (
  id            uuid primary key default gen_random_uuid(),
  scenario_id   uuid not null references scenario(id) on delete cascade,
  class_id      uuid not null references object_class(id) on delete cascade,
  code          text not null,
  label         text not null,
  sort_order    int not null default 0,
  unique (class_id, code)
);

-- ---------------------------------------------------------------------
-- Field definitions = the columns of a class. Add/remove at will.
-- A field is either an input (default_value) or computed (default_formula),
-- and any single object may override either one.
-- ---------------------------------------------------------------------
create table field_def (
  id               uuid primary key default gen_random_uuid(),
  scenario_id      uuid not null references scenario(id) on delete cascade,
  class_id         uuid not null references object_class(id) on delete cascade,
  key              text not null,
  label            text not null,
  data_type        text not null default 'number'
                     check (data_type in ('number', 'text', 'boolean', 'date', 'reference')),
  group_id         uuid references field_group(id) on delete set null,
  uom_id           uuid references uom(id) on delete set null,
  default_value    numeric(20, 8),
  default_text     text,
  default_formula  text,
  -- when set, the field sums every *other* field carrying this rollup tag
  rollup_group     text,
  is_total         boolean not null default false,
  is_locked        boolean not null default false,
  is_active        boolean not null default true,
  decimals         int not null default 2,
  prefix           text,
  suffix           text,
  width            int,
  description      text,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (class_id, key),
  constraint field_def_key_slug check (key ~ '^[a-z][a-z0-9_]*$')
);

-- tag a field as a member of a rollup bucket (a field can feed several totals)
create table field_rollup_tag (
  field_def_id  uuid not null references field_def(id) on delete cascade,
  tag           text not null,
  sign          numeric(4, 2) not null default 1,   -- -1 to subtract (credits, rebates)
  primary key (field_def_id, tag)
);

-- ---------------------------------------------------------------------
-- Cost objects: the rows. A milk batch type, a SKU, a packaging item, a
-- recipe/intermediate - all the same shape, distinguished by class.
-- ---------------------------------------------------------------------
create table cost_object (
  id           uuid primary key default gen_random_uuid(),
  scenario_id  uuid not null references scenario(id) on delete cascade,
  class_id     uuid not null references object_class(id) on delete restrict,
  code         text not null,
  name         text not null,
  parent_id    uuid references cost_object(id) on delete set null,
  uom_id       uuid references uom(id) on delete set null,
  is_active    boolean not null default true,
  notes        text,
  tags         text[] not null default '{}',
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (scenario_id, code),
  constraint cost_object_code_slug check (code ~ '^[a-z][a-z0-9_]*$')
);

-- ---------------------------------------------------------------------
-- Field values: the cells. formula wins over value_* when present.
-- computed_* caches the last evaluation so the sheet renders without a
-- recompute round trip.
-- ---------------------------------------------------------------------
create table field_value (
  id             uuid primary key default gen_random_uuid(),
  object_id      uuid not null references cost_object(id) on delete cascade,
  field_def_id   uuid not null references field_def(id) on delete cascade,
  formula        text,
  value_num      numeric(20, 8),
  value_text     text,
  value_bool     boolean,
  value_ref      uuid references cost_object(id) on delete set null,
  computed_num   numeric(20, 8),
  computed_text  text,
  computed_at    timestamptz,
  error          text,
  updated_at     timestamptz not null default now(),
  unique (object_id, field_def_id)
);

-- ---------------------------------------------------------------------
-- Bill of material / recipe lines. Used for composite products
-- (curd + sugar + kesar -> shrikhand) and for packaging build-ups
-- (cup + foil lid + carton/12).
-- Amount defaults to qty * rate / divisor * (1 + loss_pct), but any of the
-- four can be a formula instead.
-- ---------------------------------------------------------------------
create table bom_line (
  id                  uuid primary key default gen_random_uuid(),
  scenario_id         uuid not null references scenario(id) on delete cascade,
  parent_object_id    uuid not null references cost_object(id) on delete cascade,
  component_object_id uuid references cost_object(id) on delete restrict,
  line_type           text not null default 'input'
                        check (line_type in ('input', 'packaging', 'labour', 'overhead',
                                             'transport', 'additive', 'credit', 'other')),
  label               text,
  qty                 numeric(20, 8) default 1,
  qty_formula         text,
  uom_id              uuid references uom(id) on delete set null,
  rate                numeric(20, 8),
  rate_formula        text,
  divisor             numeric(20, 8) not null default 1,
  divisor_formula     text,
  loss_pct            numeric(10, 6) not null default 0,
  amount_formula      text,
  include_in_total    boolean not null default true,
  computed_qty        numeric(20, 8),
  computed_rate       numeric(20, 8),
  computed_divisor    numeric(20, 8),
  computed_amount     numeric(20, 8),
  computed_at         timestamptz,
  error               text,
  notes               text,
  sort_order          int not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint bom_line_no_self_ref check (component_object_id is null
                                         or component_object_id <> parent_object_id)
);

-- ---------------------------------------------------------------------
-- Calculation runs + the dependency graph the engine discovers.
-- dependency_edge answers "what breaks if I change this?" in the UI.
-- ---------------------------------------------------------------------
create table calc_run (
  id            uuid primary key default gen_random_uuid(),
  scenario_id   uuid not null references scenario(id) on delete cascade,
  status        text not null default 'running'
                  check (status in ('running', 'ok', 'error')),
  node_count    int,
  error_count   int not null default 0,
  duration_ms   int,
  triggered_by  text,
  error         text,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz
);

create table dependency_edge (
  id           uuid primary key default gen_random_uuid(),
  scenario_id  uuid not null references scenario(id) on delete cascade,
  src_ref      text not null,   -- node that is read     e.g. 'param:base_rate'
  dst_ref      text not null,   -- node that reads it    e.g. 'field:tm_500.material_cost'
  unique (scenario_id, src_ref, dst_ref)
);

-- ---------------------------------------------------------------------
-- Audit trail - every edit, old and new, for ERP-grade traceability.
-- ---------------------------------------------------------------------
create table change_log (
  id           bigserial primary key,
  scenario_id  uuid,
  table_name   text not null,
  record_id    uuid,
  action       text not null check (action in ('insert', 'update', 'delete')),
  ref          text,
  old_row      jsonb,
  new_row      jsonb,
  actor        text,
  note         text,
  changed_at   timestamptz not null default now()
);

-- =====================================================================
-- Indexes
-- =====================================================================
create index on parameter (scenario_id);
create index on object_class (scenario_id);
create index on field_group (scenario_id);
create index on field_def (scenario_id);
create index on field_def (class_id, sort_order);
create index on cost_object (scenario_id);
create index on cost_object (class_id, sort_order);
create index on cost_object (parent_id);
create index on field_value (field_def_id);
create index on field_value (object_id);
create index on bom_line (parent_object_id, sort_order);
create index on bom_line (component_object_id);
create index on dependency_edge (scenario_id, src_ref);
create index on dependency_edge (scenario_id, dst_ref);
create index on change_log (scenario_id, changed_at desc);
create index on change_log (table_name, record_id);

-- =====================================================================
-- Triggers
-- =====================================================================
create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare t text;
begin
  foreach t in array array['scenario', 'parameter', 'object_class', 'field_def',
                           'cost_object', 'field_value', 'bom_line']
  loop
    execute format(
      'create trigger %1$s_touch before update on %1$s
         for each row execute function touch_updated_at()', t);
  end loop;
end $$;

-- Generic audit trigger. Skips writes that only refresh cached results so the
-- log stays a record of human edits, not of recalculation.
create or replace function log_change() returns trigger as $$
declare
  sid uuid;
  o jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  n jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  noise text[] := array['computed_num', 'computed_text', 'computed_qty', 'computed_rate',
                        'computed_divisor', 'computed_amount', 'computed_at', 'error',
                        'updated_at'];
begin
  if tg_op = 'UPDATE'
     and (o - noise) is not distinct from (n - noise) then
    return new;
  end if;

  -- a field_value row that carries no input at all is just a calculation cache
  if tg_table_name = 'field_value' and tg_op = 'INSERT'
     and n ->> 'formula' is null and n ->> 'value_num' is null
     and n ->> 'value_text' is null and n ->> 'value_bool' is null then
    return new;
  end if;

  sid := coalesce(n, o) ->> 'scenario_id';
  if sid is null and tg_table_name in ('field_value') then
    select object.scenario_id into sid
      from cost_object object
     where object.id = (coalesce(n, o) ->> 'object_id')::uuid;
  end if;

  insert into change_log (scenario_id, table_name, record_id, action, old_row, new_row, actor)
  values (sid, tg_table_name, (coalesce(n, o) ->> 'id')::uuid, lower(tg_op),
          o, n, current_setting('app.actor', true));

  return coalesce(new, old);
end;
$$ language plpgsql;

do $$
declare t text;
begin
  foreach t in array array['parameter', 'object_class', 'field_def', 'cost_object',
                           'field_value', 'bom_line']
  loop
    execute format(
      'create trigger %1$s_audit after insert or update or delete on %1$s
         for each row execute function log_change()', t);
  end loop;
end $$;

-- =====================================================================
-- Read helpers
-- =====================================================================

-- Flattened cell view: one row per object/field with the effective formula
-- and the last computed number.
create view v_cell as
select
  o.scenario_id,
  c.code            as class_code,
  o.id              as object_id,
  o.code            as object_code,
  o.name            as object_name,
  o.sort_order      as object_sort,
  f.id              as field_def_id,
  f.key             as field_key,
  f.label           as field_label,
  f.sort_order      as field_sort,
  f.data_type,
  -- mirrors the engine's precedence: a row's own formula wins, then its own
  -- literal, then the column's formula, then the column's default
  case
    when v.formula is not null then v.formula
    when v.value_num is null and v.value_text is null then f.default_formula
  end                                               as formula,
  v.formula is not null                             as formula_overridden,
  case
    when v.value_num is not null then v.value_num
    when v.formula is null and f.default_formula is null then f.default_value
  end                                               as input_num,
  case
    when v.value_text is not null then v.value_text
    when v.formula is null and f.default_formula is null then f.default_text
  end                                               as input_text,
  v.computed_num,
  v.computed_text,
  v.error,
  v.computed_at
from cost_object o
join object_class c on c.id = o.class_id
join field_def f on f.class_id = o.class_id and f.is_active
left join field_value v on v.object_id = o.id and v.field_def_id = f.id;

-- Everything a given node feeds into, transitively - the impact preview.
create or replace function impact_of(p_scenario uuid, p_ref text)
returns table (ref text, depth int) as $$
  with recursive walk (ref, depth) as (
    select p_ref, 0
    union
    select e.dst_ref, w.depth + 1
      from dependency_edge e
      join walk w on e.src_ref = w.ref
     where e.scenario_id = p_scenario
       and w.depth < 25
  )
  select ref, min(depth) from walk where ref <> p_ref group by ref;
$$ language sql stable;
