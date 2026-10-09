--
-- PostgreSQL database dump
--

\restrict Y3npougunf02gx9OU2FdCZZ7L3uhVMPY9lN8i3VLgnzF1Q8n15XrQJRBJDpslrP

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: impact_of(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.impact_of(p_scenario uuid, p_ref text) RETURNS TABLE(ref text, depth integer)
    LANGUAGE sql STABLE
    AS $$
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
$$;


--
-- Name: log_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: milk_chart_rate(uuid, date, numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.milk_chart_rate(p_scenario uuid, p_day date, p_fat numeric, p_clr numeric) RETURNS numeric
    LANGUAGE sql STABLE
    AS $$
  select c.rate
    from (select g.id from milk_rate_grid g
           where g.scenario_id = p_scenario and g.effective_from <= p_day
           order by g.effective_from desc limit 1) g
    join milk_rate_grid_cell c
      on c.grid_id = g.id
     and c.fat = round(p_fat, 1)
     and c.clr = round(p_clr * 2) / 2;
$$;


--
-- Name: milk_kg_per_litre(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.milk_kg_per_litre(p_scenario uuid) RETURNS numeric
    LANGUAGE sql STABLE
    AS $$
  select coalesce(
    (select value_num from parameter
      where scenario_id = p_scenario
        and key = 'milk_kg_per_litre'
        and value_num is not null
        and value_num > 0
      limit 1),
    1.03);
$$;


--
-- Name: milk_price(uuid, date, numeric, numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.milk_price(p_scenario uuid, p_day date, p_fat numeric, p_clr numeric, p_app_rate numeric) RETURNS numeric
    LANGUAGE sql STABLE
    AS $$
  select case
    when exists (select 1 from milk_rate_grid g where g.scenario_id = p_scenario and g.effective_from <= p_day)
      then milk_chart_rate(p_scenario, p_day, p_fat, p_clr)
    else nullif(p_app_rate, 0)
  end;
$$;


--
-- Name: touch_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: app_user; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_user (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    name text NOT NULL,
    role text DEFAULT 'editor'::text NOT NULL,
    password_hash text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT app_user_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'editor'::text, 'viewer'::text])))
);


--
-- Name: bom_line; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bom_line (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scenario_id uuid NOT NULL,
    parent_object_id uuid NOT NULL,
    component_object_id uuid,
    line_type text DEFAULT 'input'::text NOT NULL,
    label text,
    qty numeric(20,8) DEFAULT 1,
    qty_formula text,
    uom_id uuid,
    rate numeric(20,8),
    rate_formula text,
    divisor numeric(20,8) DEFAULT 1 NOT NULL,
    divisor_formula text,
    loss_pct numeric(10,6) DEFAULT 0 NOT NULL,
    amount_formula text,
    include_in_total boolean DEFAULT true NOT NULL,
    computed_qty numeric(20,8),
    computed_rate numeric(20,8),
    computed_divisor numeric(20,8),
    computed_amount numeric(20,8),
    computed_at timestamp with time zone,
    error text,
    notes text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bom_line_line_type_check CHECK ((line_type = ANY (ARRAY['input'::text, 'packaging'::text, 'labour'::text, 'overhead'::text, 'transport'::text, 'additive'::text, 'credit'::text, 'other'::text]))),
    CONSTRAINT bom_line_no_self_ref CHECK (((component_object_id IS NULL) OR (component_object_id <> parent_object_id)))
);


--
-- Name: bulk_batch; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bulk_batch (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scenario_id uuid NOT NULL,
    batch_date date NOT NULL,
    bulk_product_id uuid NOT NULL,
    batch_no text,
    output_qty numeric(20,4),
    milk_litre numeric(20,4),
    milk_fat_pct numeric(20,4),
    milk_snf_pct numeric(20,4),
    labour_workers numeric(20,2),
    labour_hours numeric(20,2),
    labour_cost numeric(20,4),
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    milk_cost numeric(20,2)
);


--
-- Name: bulk_batch_ingredient; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bulk_batch_ingredient (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_id uuid NOT NULL,
    ingredient_id uuid,
    name text NOT NULL,
    qty numeric(20,4) NOT NULL,
    unit text DEFAULT 'kg'::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    CONSTRAINT bulk_batch_ingredient_qty_check CHECK ((qty > (0)::numeric))
);


--
-- Name: bulk_product; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bulk_product (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scenario_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    unit text DEFAULT 'kg'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    notes text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bulk_product_code_slug CHECK ((code ~ '^[a-z][a-z0-9_]*$'::text)),
    CONSTRAINT bulk_product_unit_check CHECK ((unit = ANY (ARRAY['kg'::text, 'L'::text])))
);


--
-- Name: bulk_product_ingredient; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bulk_product_ingredient (
    bulk_product_id uuid NOT NULL,
    ingredient_id uuid NOT NULL,
    unit text DEFAULT 'kg'::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);


--
-- Name: calc_run; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calc_run (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scenario_id uuid NOT NULL,
    status text DEFAULT 'running'::text NOT NULL,
    node_count integer,
    error_count integer DEFAULT 0 NOT NULL,
    duration_ms integer,
    triggered_by text,
    error text,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    CONSTRAINT calc_run_status_check CHECK ((status = ANY (ARRAY['running'::text, 'ok'::text, 'error'::text])))
);


--
-- Name: change_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.change_log (
    id bigint NOT NULL,
    scenario_id uuid,
    table_name text NOT NULL,
    record_id uuid,
    action text NOT NULL,
    ref text,
    old_row jsonb,
    new_row jsonb,
    actor text,
    note text,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT change_log_action_check CHECK ((action = ANY (ARRAY['insert'::text, 'update'::text, 'delete'::text])))
);


--
-- Name: change_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.change_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: change_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.change_log_id_seq OWNED BY public.change_log.id;


--
-- Name: cost_object; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cost_object (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scenario_id uuid NOT NULL,
    class_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    parent_id uuid,
    uom_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    notes text,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cost_object_code_slug CHECK ((code ~ '^[a-z][a-z0-9_]*$'::text))
);


--
-- Name: daily_material_use; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_material_use (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    day_id uuid NOT NULL,
    product_id uuid NOT NULL,
    material_id uuid,
    label text,
    qty numeric(20,6),
    rate numeric(20,6),
    amount numeric(20,4)
);


--
-- Name: daily_overhead; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_overhead (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    day_id uuid NOT NULL,
    head_id uuid NOT NULL,
    qty numeric(20,4),
    rate numeric(20,4),
    amount numeric(20,4),
    notes text
);


--
-- Name: daily_product_cost; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_product_cost (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    day_id uuid NOT NULL,
    product_id uuid NOT NULL,
    qty_produced numeric(20,4),
    pack_size numeric(20,6),
    milk_qty_per_unit numeric(20,6),
    milk_rate numeric(20,6),
    conversion_rate numeric(20,6),
    material_cost numeric(20,6),
    conversion_cost numeric(20,6),
    packing_cost numeric(20,6),
    other_cost numeric(20,6),
    unit_cost numeric(20,6),
    cost_per_kg numeric(20,6),
    market_transport numeric(20,6),
    landed_unit_cost numeric(20,6),
    landed_per_kg numeric(20,6),
    total_cost numeric(20,4),
    computed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: daily_production; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_production (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    day_id uuid NOT NULL,
    product_id uuid NOT NULL,
    qty_produced numeric(20,4) DEFAULT 0 NOT NULL,
    notes text
);


--
-- Name: demo_seed; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.demo_seed (
    id bigint NOT NULL,
    tbl text NOT NULL,
    row_id uuid NOT NULL,
    old jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: demo_seed_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.demo_seed_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: demo_seed_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.demo_seed_id_seq OWNED BY public.demo_seed.id;


--
-- Name: dependency_edge; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dependency_edge (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scenario_id uuid NOT NULL,
    src_ref text NOT NULL,
    dst_ref text NOT NULL
);


--
-- Name: diesel_price; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.diesel_price (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scenario_id uuid NOT NULL,
    effective_from date NOT NULL,
    price_per_litre numeric(20,4) NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT diesel_price_price_per_litre_check CHECK ((price_per_litre >= (0)::numeric))
);


--
-- Name: electricity_rate; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.electricity_rate (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scenario_id uuid NOT NULL,
    effective_from date NOT NULL,
    rate numeric(20,4) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT electricity_rate_rate_check CHECK ((rate >= (0)::numeric))
);


--
-- Name: farmer_transporter; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.farmer_transporter (
    scenario_id uuid NOT NULL,
    center text NOT NULL,
    farmer_code text NOT NULL,
    transporter_id uuid NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: field_def; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.field_def (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scenario_id uuid NOT NULL,
    class_id uuid NOT NULL,
    key text NOT NULL,
    label text NOT NULL,
    data_type text DEFAULT 'number'::text NOT NULL,
    group_id uuid,
    uom_id uuid,
    default_value numeric(20,8),
    default_text text,
    default_formula text,
    rollup_group text,
    is_total boolean DEFAULT false NOT NULL,
    is_locked boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    decimals integer DEFAULT 2 NOT NULL,
    prefix text,
    suffix text,
    width integer,
    description text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT field_def_data_type_check CHECK ((data_type = ANY (ARRAY['number'::text, 'text'::text, 'boolean'::text, 'date'::text, 'reference'::text]))),
    CONSTRAINT field_def_key_slug CHECK ((key ~ '^[a-z][a-z0-9_]*$'::text))
);


--
-- Name: field_group; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.field_group (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scenario_id uuid NOT NULL,
    class_id uuid NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);


--
-- Name: field_rollup_tag; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.field_rollup_tag (
    field_def_id uuid NOT NULL,
    tag text NOT NULL,
    sign numeric(4,2) DEFAULT 1 NOT NULL
);


--
-- Name: field_value; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.field_value (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    object_id uuid NOT NULL,
    field_def_id uuid NOT NULL,
    formula text,
    value_num numeric(20,8),
    value_text text,
    value_bool boolean,
    value_ref uuid,
    computed_num numeric(20,8),
    computed_text text,
    computed_at timestamp with time zone,
    error text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: milk_rate_chart; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.milk_rate_chart (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scenario_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    milk_type text DEFAULT 'mixed'::text NOT NULL,
    basis text DEFAULT 'solids'::text NOT NULL,
    rate_solid numeric(20,4),
    rate_fat numeric(20,4),
    rate_snf numeric(20,4),
    flat_rate numeric(20,4),
    effective_from date DEFAULT CURRENT_DATE NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    notes text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT milk_rate_chart_basis_check CHECK ((basis = ANY (ARRAY['solids'::text, 'fat_snf'::text, 'fat_only'::text, 'per_kg'::text, 'per_litre'::text]))),
    CONSTRAINT milk_rate_chart_code_slug CHECK ((code ~ '^[a-z][a-z0-9_]*$'::text)),
    CONSTRAINT milk_rate_chart_milk_type_check CHECK ((milk_type = ANY (ARRAY['cow'::text, 'buffalo'::text, 'mixed'::text])))
);


--
-- Name: milk_rate_grid; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.milk_rate_grid (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scenario_id uuid NOT NULL,
    name text NOT NULL,
    effective_from date NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: milk_rate_grid_cell; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.milk_rate_grid_cell (
    grid_id uuid NOT NULL,
    fat numeric(4,1) NOT NULL,
    clr numeric(4,1) NOT NULL,
    rate numeric(10,2) NOT NULL,
    CONSTRAINT milk_rate_grid_cell_rate_check CHECK ((rate >= (0)::numeric))
);


--
-- Name: object_class; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.object_class (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scenario_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    plural_name text,
    description text,
    allows_bom boolean DEFAULT true NOT NULL,
    cost_field text,
    is_locked boolean DEFAULT false NOT NULL,
    color text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT object_class_code_slug CHECK ((code ~ '^[a-z][a-z0-9_]*$'::text))
);


--
-- Name: overhead_head; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.overhead_head (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scenario_id uuid NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    unit text,
    is_active boolean DEFAULT true NOT NULL,
    notes text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT overhead_head_code_slug CHECK ((code ~ '^[a-z][a-z0-9_]*$'::text))
);


--
-- Name: parameter; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parameter (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scenario_id uuid NOT NULL,
    key text NOT NULL,
    label text NOT NULL,
    group_name text DEFAULT 'General'::text NOT NULL,
    value_num numeric(20,8),
    formula text,
    uom_id uuid,
    min_value numeric(20,8),
    max_value numeric(20,8),
    decimals integer DEFAULT 4 NOT NULL,
    suffix text,
    description text,
    is_locked boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    computed_num numeric(20,8),
    computed_at timestamp with time zone,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT parameter_key_slug CHECK ((key ~ '^[a-z][a-z0-9_]*$'::text))
);


--
-- Name: plant_fuel; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plant_fuel (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scenario_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    unit text DEFAULT 'kg'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT plant_fuel_code_slug CHECK ((code ~ '^[a-z][a-z0-9_]*$'::text))
);


--
-- Name: plant_fuel_day; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plant_fuel_day (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scenario_id uuid NOT NULL,
    fuel_id uuid NOT NULL,
    day date NOT NULL,
    qty numeric(20,3) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT plant_fuel_day_qty_check CHECK ((qty >= (0)::numeric))
);


--
-- Name: plant_fuel_rate; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plant_fuel_rate (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fuel_id uuid NOT NULL,
    effective_from date NOT NULL,
    rate numeric(20,4) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT plant_fuel_rate_rate_check CHECK ((rate >= (0)::numeric))
);


--
-- Name: procurement_batch; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.procurement_batch (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scenario_id uuid NOT NULL,
    center_id uuid NOT NULL,
    rate_chart_id uuid NOT NULL,
    trip_id uuid,
    collected_on date NOT NULL,
    shift text DEFAULT 'morning'::text NOT NULL,
    qty_kg numeric(20,4) NOT NULL,
    fat_pct numeric(20,4),
    snf_pct numeric(20,4),
    qty_litre numeric(20,4),
    kg_fat numeric(20,6),
    kg_snf numeric(20,6),
    kg_solids numeric(20,6),
    farmer_amount numeric(20,4),
    commission_amount numeric(20,4),
    farmer_rate_per_kg numeric(20,6),
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT procurement_batch_shift_check CHECK ((shift = ANY (ARRAY['morning'::text, 'evening'::text])))
);


--
-- Name: procurement_center; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.procurement_center (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scenario_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    sachiv_name text,
    village text,
    route text,
    distance_km numeric(20,2),
    rate_chart_id uuid,
    commission_mode text DEFAULT 'per_kg'::text NOT NULL,
    commission_rate numeric(20,4),
    is_active boolean DEFAULT true NOT NULL,
    notes text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT procurement_center_code_slug CHECK ((code ~ '^[a-z][a-z0-9_]*$'::text)),
    CONSTRAINT procurement_center_commission_mode_check CHECK ((commission_mode = ANY (ARRAY['per_kg'::text, 'per_litre'::text, 'pct_of_value'::text, 'none'::text])))
);


--
-- Name: production_day; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.production_day (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scenario_id uuid NOT NULL,
    day date NOT NULL,
    milk_processed_l numeric(20,4),
    status text DEFAULT 'open'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT production_day_status_check CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text])))
);


--
-- Name: scenario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scenario (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    effective_from date DEFAULT CURRENT_DATE NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    currency text DEFAULT 'INR'::text NOT NULL,
    cloned_from_id uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT scenario_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'archived'::text])))
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    filename text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sku; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sku (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scenario_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    case_unit text DEFAULT 'PCS'::text NOT NULL,
    pcs_per_case integer DEFAULT 1 NOT NULL,
    shelf_life_days integer,
    bulk_product_id uuid,
    bulk_qty_per_pc numeric(20,4),
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sku_bulk_qty_per_pc_check CHECK ((bulk_qty_per_pc >= (0)::numeric)),
    CONSTRAINT sku_pcs_per_case_check CHECK ((pcs_per_case > 0))
);


--
-- Name: sku_pack_day; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sku_pack_day (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scenario_id uuid NOT NULL,
    sku_id uuid NOT NULL,
    day date NOT NULL,
    cases numeric(20,3) DEFAULT 0 NOT NULL,
    loose_pcs numeric(20,3) DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sku_pack_day_cases_check CHECK ((cases >= (0)::numeric)),
    CONSTRAINT sku_pack_day_loose_pcs_check CHECK ((loose_pcs >= (0)::numeric))
);


--
-- Name: sku_pack_material; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sku_pack_material (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scenario_id uuid NOT NULL,
    sku_id uuid NOT NULL,
    day date NOT NULL,
    packaging_id uuid,
    name text NOT NULL,
    qty numeric(20,3) NOT NULL,
    unit text NOT NULL,
    price numeric(20,4) NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sku_pack_material_price_check CHECK ((price >= (0)::numeric)),
    CONSTRAINT sku_pack_material_qty_check CHECK ((qty > (0)::numeric)),
    CONSTRAINT sku_pack_material_unit_check CHECK ((unit = ANY (ARRAY['kg'::text, 'pcs'::text])))
);


--
-- Name: sku_packing_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sku_packing_item (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sku_id uuid NOT NULL,
    packaging_id uuid NOT NULL,
    qty numeric(20,6) NOT NULL,
    per text DEFAULT 'pc'::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    CONSTRAINT sku_packing_item_per_check CHECK ((per = ANY (ARRAY['pc'::text, 'case'::text]))),
    CONSTRAINT sku_packing_item_qty_check CHECK ((qty > (0)::numeric))
);


--
-- Name: tank; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tank (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scenario_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    capacity_litre numeric(20,4),
    is_active boolean DEFAULT true NOT NULL,
    notes text,
    sort_order integer DEFAULT 0 NOT NULL,
    qty_litre numeric(20,4) DEFAULT 0 NOT NULL,
    fat_pct numeric(20,4) DEFAULT 0 NOT NULL,
    snf_pct numeric(20,4) DEFAULT 0 NOT NULL,
    cost_per_litre numeric(20,4) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tank_code_slug CHECK ((code ~ '^[a-z][a-z0-9_]*$'::text))
);


--
-- Name: tank_movement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tank_movement (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scenario_id uuid NOT NULL,
    tank_id uuid NOT NULL,
    movement_date date NOT NULL,
    direction text NOT NULL,
    qty_litre numeric(20,4) NOT NULL,
    fat_pct numeric(20,4),
    snf_pct numeric(20,4),
    cost_per_litre numeric(20,4),
    balance_litre numeric(20,4) DEFAULT 0 NOT NULL,
    balance_fat_pct numeric(20,4) DEFAULT 0 NOT NULL,
    balance_snf_pct numeric(20,4) DEFAULT 0 NOT NULL,
    balance_cost_per_litre numeric(20,4) DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    source text,
    source_ref text,
    bulk_batch_id uuid,
    transfer_of uuid,
    CONSTRAINT tank_movement_direction_check CHECK ((direction = ANY (ARRAY['in'::text, 'out'::text]))),
    CONSTRAINT tank_movement_qty_litre_check CHECK ((qty_litre > (0)::numeric))
);


--
-- Name: tanker_trip; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tanker_trip (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scenario_id uuid NOT NULL,
    trip_date date NOT NULL,
    tanker_code text NOT NULL,
    vehicle_no text,
    route text,
    distance_km numeric(20,2),
    cost_mode text DEFAULT 'per_trip'::text NOT NULL,
    rate numeric(20,4),
    other_cost numeric(20,4) DEFAULT 0 NOT NULL,
    cost_override numeric(20,4),
    received_qty_kg numeric(20,4),
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tanker_trip_cost_mode_check CHECK ((cost_mode = ANY (ARRAY['per_trip'::text, 'per_km'::text, 'per_kg'::text, 'per_litre'::text])))
);


--
-- Name: transport_run; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transport_run (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scenario_id uuid NOT NULL,
    transporter_id uuid NOT NULL,
    run_date date NOT NULL,
    distance_km numeric(20,2),
    trips numeric(20,2),
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    diesel_litre numeric(20,2)
);


--
-- Name: transporter; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transporter (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scenario_id uuid NOT NULL,
    section text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    notes text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    distance_km numeric(20,2),
    trips_per_day numeric(20,2),
    diesel_litre_per_day numeric(20,2),
    CONSTRAINT transporter_code_slug CHECK ((code ~ '^[a-z][a-z0-9_]*$'::text)),
    CONSTRAINT transporter_section_check CHECK ((section = ANY (ARRAY['milk_to_plant'::text, 'delivery'::text])))
);


--
-- Name: transporter_rate; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transporter_rate (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scenario_id uuid NOT NULL,
    transporter_id uuid NOT NULL,
    effective_from date NOT NULL,
    cost_basis text NOT NULL,
    rate numeric(20,4),
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT transporter_rate_cost_basis_check CHECK ((cost_basis = ANY (ARRAY['per_km'::text, 'per_trip'::text, 'diesel'::text]))),
    CONSTRAINT transporter_rate_needs_rate CHECK (((cost_basis = 'diesel'::text) OR (rate IS NOT NULL))),
    CONSTRAINT transporter_rate_rate_check CHECK ((rate >= (0)::numeric))
);


--
-- Name: uom; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.uom (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    dimension text NOT NULL,
    factor_to_base numeric(20,10) DEFAULT 1 NOT NULL,
    base_code text,
    sort_order integer DEFAULT 0 NOT NULL,
    CONSTRAINT uom_dimension_check CHECK ((dimension = ANY (ARRAY['mass'::text, 'volume'::text, 'count'::text, 'currency'::text, 'ratio'::text, 'time'::text, 'other'::text])))
);


--
-- Name: v_cell; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_cell AS
 SELECT o.scenario_id,
    c.code AS class_code,
    o.id AS object_id,
    o.code AS object_code,
    o.name AS object_name,
    o.sort_order AS object_sort,
    f.id AS field_def_id,
    f.key AS field_key,
    f.label AS field_label,
    f.sort_order AS field_sort,
    f.data_type,
        CASE
            WHEN (v.formula IS NOT NULL) THEN v.formula
            WHEN ((v.value_num IS NULL) AND (v.value_text IS NULL)) THEN f.default_formula
            ELSE NULL::text
        END AS formula,
    (v.formula IS NOT NULL) AS formula_overridden,
        CASE
            WHEN (v.value_num IS NOT NULL) THEN v.value_num
            WHEN ((v.formula IS NULL) AND (f.default_formula IS NULL)) THEN f.default_value
            ELSE NULL::numeric
        END AS input_num,
        CASE
            WHEN (v.value_text IS NOT NULL) THEN v.value_text
            WHEN ((v.formula IS NULL) AND (f.default_formula IS NULL)) THEN f.default_text
            ELSE NULL::text
        END AS input_text,
    v.computed_num,
    v.computed_text,
    v.error,
    v.computed_at
   FROM (((public.cost_object o
     JOIN public.object_class c ON ((c.id = o.class_id)))
     JOIN public.field_def f ON (((f.class_id = o.class_id) AND f.is_active)))
     LEFT JOIN public.field_value v ON (((v.object_id = o.id) AND (v.field_def_id = f.id))));


--
-- Name: v_daily_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_daily_summary AS
 SELECT d.id AS day_id,
    d.scenario_id,
    d.day,
    d.status,
    d.milk_processed_l,
    COALESCE(o.total_overhead, (0)::numeric) AS total_overhead,
        CASE
            WHEN (COALESCE(d.milk_processed_l, (0)::numeric) > (0)::numeric) THEN (COALESCE(o.total_overhead, (0)::numeric) / d.milk_processed_l)
            ELSE NULL::numeric
        END AS conversion_rate,
    COALESCE(p.products_made, (0)::bigint) AS products_made,
    COALESCE(c.total_production_cost, (0)::numeric) AS total_production_cost,
        CASE
            WHEN (COALESCE(d.milk_processed_l, (0)::numeric) > (0)::numeric) THEN (COALESCE(c.total_production_cost, (0)::numeric) / d.milk_processed_l)
            ELSE NULL::numeric
        END AS cost_per_litre
   FROM (((public.production_day d
     LEFT JOIN LATERAL ( SELECT sum(daily_overhead.amount) AS total_overhead
           FROM public.daily_overhead
          WHERE (daily_overhead.day_id = d.id)) o ON (true))
     LEFT JOIN LATERAL ( SELECT count(*) AS products_made
           FROM public.daily_production
          WHERE ((daily_production.day_id = d.id) AND (daily_production.qty_produced > (0)::numeric))) p ON (true))
     LEFT JOIN LATERAL ( SELECT sum(daily_product_cost.total_cost) AS total_production_cost
           FROM public.daily_product_cost
          WHERE (daily_product_cost.day_id = d.id)) c ON (true));


--
-- Name: v_transport_run; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_transport_run AS
 SELECT r.id AS run_id,
    r.scenario_id,
    t.section,
    r.transporter_id,
    t.name AS transporter_name,
    r.run_date,
    r.distance_km,
    r.trips,
    r.diesel_litre,
    rt.cost_basis,
        CASE
            WHEN (rt.cost_basis = 'diesel'::text) THEN dp.price_per_litre
            ELSE rt.rate
        END AS rate,
    rt.effective_from AS rate_from,
        CASE
            WHEN (rt.cost_basis = 'per_km'::text) THEN (r.distance_km * rt.rate)
            WHEN (rt.cost_basis = 'per_trip'::text) THEN (r.trips * rt.rate)
            WHEN (rt.cost_basis = 'diesel'::text) THEN (r.diesel_litre * dp.price_per_litre)
            ELSE NULL::numeric
        END AS cost
   FROM (((public.transport_run r
     JOIN public.transporter t ON ((t.id = r.transporter_id)))
     LEFT JOIN LATERAL ( SELECT x.cost_basis,
            x.rate,
            x.effective_from
           FROM public.transporter_rate x
          WHERE ((x.transporter_id = r.transporter_id) AND (x.effective_from <= r.run_date))
          ORDER BY x.effective_from DESC
         LIMIT 1) rt ON (true))
     LEFT JOIN LATERAL ( SELECT p.price_per_litre
           FROM public.diesel_price p
          WHERE ((p.scenario_id = r.scenario_id) AND (p.effective_from <= r.run_date))
          ORDER BY p.effective_from DESC
         LIMIT 1) dp ON (true));


--
-- Name: vamaa_collection; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vamaa_collection (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    center text NOT NULL,
    day date NOT NULL,
    farmer_code text NOT NULL,
    shift text NOT NULL,
    milk_type text,
    qty_litre numeric(20,4) DEFAULT 0 NOT NULL,
    fat_pct numeric(20,4),
    snf_pct numeric(20,4),
    clr numeric(20,4),
    rate numeric(20,4),
    amount numeric(20,4),
    raw jsonb NOT NULL,
    fetched_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: v_farmer_transport_day; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_farmer_transport_day AS
 WITH farmer_day AS (
         SELECT ft.scenario_id,
            c.center,
            c.farmer_code,
            ft.transporter_id,
            c.day,
            sum(c.qty_litre) AS litres
           FROM (public.vamaa_collection c
             JOIN public.farmer_transporter ft ON (((ft.center = c.center) AND (ft.farmer_code = c.farmer_code))))
          GROUP BY ft.scenario_id, c.center, c.farmer_code, ft.transporter_id, c.day
         HAVING (sum(c.qty_litre) > (0)::numeric)
        ), carried AS (
         SELECT farmer_day.scenario_id,
            farmer_day.transporter_id,
            farmer_day.day,
            sum(farmer_day.litres) AS litres,
            count(*) AS farmers
           FROM farmer_day
          GROUP BY farmer_day.scenario_id, farmer_day.transporter_id, farmer_day.day
        ), day_cost AS (
         SELECT v_transport_run.scenario_id,
            v_transport_run.transporter_id,
            v_transport_run.run_date AS day,
            sum(v_transport_run.cost) AS cost
           FROM public.v_transport_run
          GROUP BY v_transport_run.scenario_id, v_transport_run.transporter_id, v_transport_run.run_date
        )
 SELECT f.scenario_id,
    f.center,
    f.farmer_code,
    f.transporter_id,
    f.day,
    f.litres,
    k.litres AS transporter_litres,
    dc.cost AS transporter_cost,
    (dc.cost / (NULLIF(k.farmers, 0))::numeric) AS cost,
    (k.farmers)::integer AS transporter_farmers
   FROM ((farmer_day f
     JOIN carried k USING (scenario_id, transporter_id, day))
     LEFT JOIN day_cost dc USING (scenario_id, transporter_id, day));


--
-- Name: v_plant_fuel_day; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_plant_fuel_day AS
 SELECT d.id,
    d.scenario_id,
    d.fuel_id,
    d.day,
    d.qty,
    r.rate,
    r.effective_from AS rate_from,
    (d.qty * r.rate) AS cost
   FROM (public.plant_fuel_day d
     LEFT JOIN LATERAL ( SELECT x.rate,
            x.effective_from
           FROM public.plant_fuel_rate x
          WHERE ((x.fuel_id = d.fuel_id) AND (x.effective_from <= d.day))
          ORDER BY x.effective_from DESC
         LIMIT 1) r ON (true));


--
-- Name: v_tanker_trip; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_tanker_trip AS
 SELECT t.id AS trip_id,
    t.scenario_id,
    t.trip_date,
    t.tanker_code,
    t.vehicle_no,
    t.route,
    t.distance_km,
    t.cost_mode,
    t.rate,
    t.other_cost,
    t.cost_override,
    t.notes,
    l.batch_count,
    l.dispatched_kg,
    (l.dispatched_kg / public.milk_kg_per_litre(t.scenario_id)) AS dispatched_litre,
    COALESCE(t.received_qty_kg, l.dispatched_kg) AS landed_kg,
    (COALESCE(t.received_qty_kg, l.dispatched_kg) / public.milk_kg_per_litre(t.scenario_id)) AS landed_litre,
    (l.dispatched_kg - COALESCE(t.received_qty_kg, l.dispatched_kg)) AS shortage_kg,
    c.trip_cost,
    (c.trip_cost / NULLIF(COALESCE(t.received_qty_kg, l.dispatched_kg), (0)::numeric)) AS cost_per_kg,
    ((c.trip_cost / NULLIF(COALESCE(t.received_qty_kg, l.dispatched_kg), (0)::numeric)) * public.milk_kg_per_litre(t.scenario_id)) AS cost_per_litre
   FROM ((public.tanker_trip t
     LEFT JOIN LATERAL ( SELECT count(*) AS batch_count,
            COALESCE(sum(b.qty_kg), (0)::numeric) AS dispatched_kg
           FROM public.procurement_batch b
          WHERE (b.trip_id = t.id)) l ON (true))
     LEFT JOIN LATERAL ( SELECT COALESCE(t.cost_override, (
                CASE t.cost_mode
                    WHEN 'per_trip'::text THEN COALESCE(t.rate, (0)::numeric)
                    WHEN 'per_km'::text THEN (COALESCE(t.rate, (0)::numeric) * COALESCE(t.distance_km, (0)::numeric))
                    WHEN 'per_kg'::text THEN (COALESCE(t.rate, (0)::numeric) * l.dispatched_kg)
                    WHEN 'per_litre'::text THEN ((COALESCE(t.rate, (0)::numeric) * l.dispatched_kg) / public.milk_kg_per_litre(t.scenario_id))
                    ELSE NULL::numeric
                END + t.other_cost)) AS trip_cost) c ON (true));


--
-- Name: v_procurement_batch; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_procurement_batch AS
 SELECT b.id AS batch_id,
    b.scenario_id,
    b.collected_on,
    b.shift,
    b.center_id,
    ct.code AS center_code,
    ct.name AS center_name,
    ct.sachiv_name,
    ct.village,
    ct.route,
    b.rate_chart_id,
    rc.code AS chart_code,
    rc.name AS chart_name,
    rc.basis AS chart_basis,
    rc.milk_type,
    b.trip_id,
    tr.tanker_code,
    b.qty_kg,
    b.qty_litre,
    b.fat_pct,
    b.snf_pct,
    b.kg_fat,
    b.kg_snf,
    b.kg_solids,
    b.farmer_amount,
    b.farmer_rate_per_kg,
    b.commission_amount,
    b.notes,
    COALESCE(((tr.trip_cost * b.qty_kg) / NULLIF(tr.dispatched_kg, (0)::numeric)), (0)::numeric) AS transport_amount,
    (b.qty_kg * COALESCE((tr.landed_kg / NULLIF(tr.dispatched_kg, (0)::numeric)), (1)::numeric)) AS landed_kg,
    ((b.qty_kg * COALESCE((tr.landed_kg / NULLIF(tr.dispatched_kg, (0)::numeric)), (1)::numeric)) / public.milk_kg_per_litre(b.scenario_id)) AS landed_litre,
    ((COALESCE(b.farmer_amount, (0)::numeric) + COALESCE(b.commission_amount, (0)::numeric)) + COALESCE(((tr.trip_cost * b.qty_kg) / NULLIF(tr.dispatched_kg, (0)::numeric)), (0)::numeric)) AS total_cost,
    (((COALESCE(b.farmer_amount, (0)::numeric) + COALESCE(b.commission_amount, (0)::numeric)) + COALESCE(((tr.trip_cost * b.qty_kg) / NULLIF(tr.dispatched_kg, (0)::numeric)), (0)::numeric)) / NULLIF((b.qty_kg * COALESCE((tr.landed_kg / NULLIF(tr.dispatched_kg, (0)::numeric)), (1)::numeric)), (0)::numeric)) AS landed_per_kg,
    ((((COALESCE(b.farmer_amount, (0)::numeric) + COALESCE(b.commission_amount, (0)::numeric)) + COALESCE(((tr.trip_cost * b.qty_kg) / NULLIF(tr.dispatched_kg, (0)::numeric)), (0)::numeric)) / NULLIF((b.qty_kg * COALESCE((tr.landed_kg / NULLIF(tr.dispatched_kg, (0)::numeric)), (1)::numeric)), (0)::numeric)) * public.milk_kg_per_litre(b.scenario_id)) AS landed_per_litre
   FROM (((public.procurement_batch b
     JOIN public.procurement_center ct ON ((ct.id = b.center_id)))
     JOIN public.milk_rate_chart rc ON ((rc.id = b.rate_chart_id)))
     LEFT JOIN public.v_tanker_trip tr ON ((tr.trip_id = b.trip_id)));


--
-- Name: v_procurement_day; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_procurement_day AS
 SELECT scenario_id,
    collected_on,
    count(*) AS batch_count,
    count(DISTINCT center_id) AS center_count,
    sum(qty_kg) AS qty_kg,
    sum(qty_litre) AS qty_litre,
    sum(landed_kg) AS landed_kg,
    sum(landed_litre) AS landed_litre,
    sum(kg_fat) AS kg_fat,
    sum(kg_snf) AS kg_snf,
    sum(kg_solids) AS kg_solids,
    ((sum(kg_fat) / NULLIF(sum(qty_kg), (0)::numeric)) * (100)::numeric) AS fat_pct,
    ((sum(kg_snf) / NULLIF(sum(qty_kg), (0)::numeric)) * (100)::numeric) AS snf_pct,
    sum(farmer_amount) AS farmer_amount,
    sum(commission_amount) AS commission_amount,
    sum(transport_amount) AS transport_amount,
    sum(total_cost) AS total_cost,
    (sum(total_cost) / NULLIF(sum(landed_kg), (0)::numeric)) AS landed_per_kg,
    (sum(total_cost) / NULLIF(sum(landed_litre), (0)::numeric)) AS landed_per_litre,
    (sum(total_cost) / NULLIF(sum(kg_solids), (0)::numeric)) AS landed_per_kg_solids
   FROM public.v_procurement_batch
  GROUP BY scenario_id, collected_on;


--
-- Name: v_sachiv_commission; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_sachiv_commission AS
 SELECT scenario_id,
    center_id,
    center_code,
    center_name,
    sachiv_name,
    min(collected_on) AS first_collection,
    max(collected_on) AS last_collection,
    count(*) AS batch_count,
    sum(qty_kg) AS qty_kg,
    sum(qty_litre) AS qty_litre,
    sum(farmer_amount) AS farmer_amount,
    sum(commission_amount) AS commission_amount,
    (sum(commission_amount) / NULLIF(sum(qty_kg), (0)::numeric)) AS commission_per_kg,
    (sum(commission_amount) / NULLIF(sum(qty_litre), (0)::numeric)) AS commission_per_litre,
    ((sum(commission_amount) / NULLIF(sum(farmer_amount), (0)::numeric)) * (100)::numeric) AS commission_pct_of_value
   FROM public.v_procurement_batch b
  GROUP BY scenario_id, center_id, center_code, center_name, sachiv_name;


--
-- Name: vamaa_center; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vamaa_center (
    center text NOT NULL,
    name text NOT NULL,
    kind text DEFAULT 'village'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    CONSTRAINT vamaa_center_kind_check CHECK ((kind = ANY (ARRAY['village'::text, 'tanker'::text])))
);


--
-- Name: vamaa_farmer; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vamaa_farmer (
    center text NOT NULL,
    code text NOT NULL,
    unique_code bigint,
    name text,
    mobile text,
    milk_type text,
    status integer,
    created_on text,
    raw jsonb NOT NULL,
    fetched_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vamaa_sync_day; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vamaa_sync_day (
    center text NOT NULL,
    day date NOT NULL,
    fetched_at timestamp with time zone DEFAULT now() NOT NULL,
    row_count integer DEFAULT 0 NOT NULL
);


--
-- Name: change_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.change_log ALTER COLUMN id SET DEFAULT nextval('public.change_log_id_seq'::regclass);


--
-- Name: demo_seed id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demo_seed ALTER COLUMN id SET DEFAULT nextval('public.demo_seed_id_seq'::regclass);


--
-- Name: app_user app_user_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT app_user_email_key UNIQUE (email);


--
-- Name: app_user app_user_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT app_user_pkey PRIMARY KEY (id);


--
-- Name: bom_line bom_line_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_line
    ADD CONSTRAINT bom_line_pkey PRIMARY KEY (id);


--
-- Name: bulk_batch_ingredient bulk_batch_ingredient_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulk_batch_ingredient
    ADD CONSTRAINT bulk_batch_ingredient_pkey PRIMARY KEY (id);


--
-- Name: bulk_batch bulk_batch_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulk_batch
    ADD CONSTRAINT bulk_batch_pkey PRIMARY KEY (id);


--
-- Name: bulk_batch bulk_batch_scenario_id_batch_date_bulk_product_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulk_batch
    ADD CONSTRAINT bulk_batch_scenario_id_batch_date_bulk_product_id_key UNIQUE (scenario_id, batch_date, bulk_product_id);


--
-- Name: bulk_product_ingredient bulk_product_ingredient_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulk_product_ingredient
    ADD CONSTRAINT bulk_product_ingredient_pkey PRIMARY KEY (bulk_product_id, ingredient_id);


--
-- Name: bulk_product bulk_product_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulk_product
    ADD CONSTRAINT bulk_product_pkey PRIMARY KEY (id);


--
-- Name: bulk_product bulk_product_scenario_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulk_product
    ADD CONSTRAINT bulk_product_scenario_id_code_key UNIQUE (scenario_id, code);


--
-- Name: calc_run calc_run_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calc_run
    ADD CONSTRAINT calc_run_pkey PRIMARY KEY (id);


--
-- Name: change_log change_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.change_log
    ADD CONSTRAINT change_log_pkey PRIMARY KEY (id);


--
-- Name: cost_object cost_object_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_object
    ADD CONSTRAINT cost_object_pkey PRIMARY KEY (id);


--
-- Name: cost_object cost_object_scenario_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_object
    ADD CONSTRAINT cost_object_scenario_id_code_key UNIQUE (scenario_id, code);


--
-- Name: daily_material_use daily_material_use_day_id_product_id_material_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_material_use
    ADD CONSTRAINT daily_material_use_day_id_product_id_material_id_key UNIQUE (day_id, product_id, material_id);


--
-- Name: daily_material_use daily_material_use_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_material_use
    ADD CONSTRAINT daily_material_use_pkey PRIMARY KEY (id);


--
-- Name: daily_overhead daily_overhead_day_id_head_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_overhead
    ADD CONSTRAINT daily_overhead_day_id_head_id_key UNIQUE (day_id, head_id);


--
-- Name: daily_overhead daily_overhead_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_overhead
    ADD CONSTRAINT daily_overhead_pkey PRIMARY KEY (id);


--
-- Name: daily_product_cost daily_product_cost_day_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_product_cost
    ADD CONSTRAINT daily_product_cost_day_id_product_id_key UNIQUE (day_id, product_id);


--
-- Name: daily_product_cost daily_product_cost_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_product_cost
    ADD CONSTRAINT daily_product_cost_pkey PRIMARY KEY (id);


--
-- Name: daily_production daily_production_day_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_production
    ADD CONSTRAINT daily_production_day_id_product_id_key UNIQUE (day_id, product_id);


--
-- Name: daily_production daily_production_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_production
    ADD CONSTRAINT daily_production_pkey PRIMARY KEY (id);


--
-- Name: demo_seed demo_seed_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demo_seed
    ADD CONSTRAINT demo_seed_pkey PRIMARY KEY (id);


--
-- Name: dependency_edge dependency_edge_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dependency_edge
    ADD CONSTRAINT dependency_edge_pkey PRIMARY KEY (id);


--
-- Name: dependency_edge dependency_edge_scenario_id_src_ref_dst_ref_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dependency_edge
    ADD CONSTRAINT dependency_edge_scenario_id_src_ref_dst_ref_key UNIQUE (scenario_id, src_ref, dst_ref);


--
-- Name: diesel_price diesel_price_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diesel_price
    ADD CONSTRAINT diesel_price_pkey PRIMARY KEY (id);


--
-- Name: diesel_price diesel_price_scenario_id_effective_from_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diesel_price
    ADD CONSTRAINT diesel_price_scenario_id_effective_from_key UNIQUE (scenario_id, effective_from);


--
-- Name: electricity_rate electricity_rate_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.electricity_rate
    ADD CONSTRAINT electricity_rate_pkey PRIMARY KEY (id);


--
-- Name: electricity_rate electricity_rate_scenario_id_effective_from_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.electricity_rate
    ADD CONSTRAINT electricity_rate_scenario_id_effective_from_key UNIQUE (scenario_id, effective_from);


--
-- Name: farmer_transporter farmer_transporter_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.farmer_transporter
    ADD CONSTRAINT farmer_transporter_pkey PRIMARY KEY (scenario_id, center, farmer_code);


--
-- Name: field_def field_def_class_id_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_def
    ADD CONSTRAINT field_def_class_id_key_key UNIQUE (class_id, key);


--
-- Name: field_def field_def_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_def
    ADD CONSTRAINT field_def_pkey PRIMARY KEY (id);


--
-- Name: field_group field_group_class_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_group
    ADD CONSTRAINT field_group_class_id_code_key UNIQUE (class_id, code);


--
-- Name: field_group field_group_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_group
    ADD CONSTRAINT field_group_pkey PRIMARY KEY (id);


--
-- Name: field_rollup_tag field_rollup_tag_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_rollup_tag
    ADD CONSTRAINT field_rollup_tag_pkey PRIMARY KEY (field_def_id, tag);


--
-- Name: field_value field_value_object_id_field_def_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_value
    ADD CONSTRAINT field_value_object_id_field_def_id_key UNIQUE (object_id, field_def_id);


--
-- Name: field_value field_value_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_value
    ADD CONSTRAINT field_value_pkey PRIMARY KEY (id);


--
-- Name: milk_rate_chart milk_rate_chart_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.milk_rate_chart
    ADD CONSTRAINT milk_rate_chart_pkey PRIMARY KEY (id);


--
-- Name: milk_rate_chart milk_rate_chart_scenario_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.milk_rate_chart
    ADD CONSTRAINT milk_rate_chart_scenario_id_code_key UNIQUE (scenario_id, code);


--
-- Name: milk_rate_grid_cell milk_rate_grid_cell_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.milk_rate_grid_cell
    ADD CONSTRAINT milk_rate_grid_cell_pkey PRIMARY KEY (grid_id, fat, clr);


--
-- Name: milk_rate_grid milk_rate_grid_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.milk_rate_grid
    ADD CONSTRAINT milk_rate_grid_pkey PRIMARY KEY (id);


--
-- Name: milk_rate_grid milk_rate_grid_scenario_id_effective_from_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.milk_rate_grid
    ADD CONSTRAINT milk_rate_grid_scenario_id_effective_from_key UNIQUE (scenario_id, effective_from);


--
-- Name: object_class object_class_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.object_class
    ADD CONSTRAINT object_class_pkey PRIMARY KEY (id);


--
-- Name: object_class object_class_scenario_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.object_class
    ADD CONSTRAINT object_class_scenario_id_code_key UNIQUE (scenario_id, code);


--
-- Name: overhead_head overhead_head_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overhead_head
    ADD CONSTRAINT overhead_head_pkey PRIMARY KEY (id);


--
-- Name: overhead_head overhead_head_scenario_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overhead_head
    ADD CONSTRAINT overhead_head_scenario_id_code_key UNIQUE (scenario_id, code);


--
-- Name: parameter parameter_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parameter
    ADD CONSTRAINT parameter_pkey PRIMARY KEY (id);


--
-- Name: parameter parameter_scenario_id_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parameter
    ADD CONSTRAINT parameter_scenario_id_key_key UNIQUE (scenario_id, key);


--
-- Name: plant_fuel_day plant_fuel_day_fuel_id_day_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plant_fuel_day
    ADD CONSTRAINT plant_fuel_day_fuel_id_day_key UNIQUE (fuel_id, day);


--
-- Name: plant_fuel_day plant_fuel_day_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plant_fuel_day
    ADD CONSTRAINT plant_fuel_day_pkey PRIMARY KEY (id);


--
-- Name: plant_fuel plant_fuel_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plant_fuel
    ADD CONSTRAINT plant_fuel_pkey PRIMARY KEY (id);


--
-- Name: plant_fuel_rate plant_fuel_rate_fuel_id_effective_from_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plant_fuel_rate
    ADD CONSTRAINT plant_fuel_rate_fuel_id_effective_from_key UNIQUE (fuel_id, effective_from);


--
-- Name: plant_fuel_rate plant_fuel_rate_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plant_fuel_rate
    ADD CONSTRAINT plant_fuel_rate_pkey PRIMARY KEY (id);


--
-- Name: plant_fuel plant_fuel_scenario_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plant_fuel
    ADD CONSTRAINT plant_fuel_scenario_id_code_key UNIQUE (scenario_id, code);


--
-- Name: procurement_batch procurement_batch_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_batch
    ADD CONSTRAINT procurement_batch_pkey PRIMARY KEY (id);


--
-- Name: procurement_batch procurement_batch_scenario_id_center_id_collected_on_shift_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_batch
    ADD CONSTRAINT procurement_batch_scenario_id_center_id_collected_on_shift_key UNIQUE (scenario_id, center_id, collected_on, shift);


--
-- Name: procurement_center procurement_center_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_center
    ADD CONSTRAINT procurement_center_pkey PRIMARY KEY (id);


--
-- Name: procurement_center procurement_center_scenario_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_center
    ADD CONSTRAINT procurement_center_scenario_id_code_key UNIQUE (scenario_id, code);


--
-- Name: production_day production_day_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_day
    ADD CONSTRAINT production_day_pkey PRIMARY KEY (id);


--
-- Name: production_day production_day_scenario_id_day_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_day
    ADD CONSTRAINT production_day_scenario_id_day_key UNIQUE (scenario_id, day);


--
-- Name: scenario scenario_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario
    ADD CONSTRAINT scenario_code_key UNIQUE (code);


--
-- Name: scenario scenario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario
    ADD CONSTRAINT scenario_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (filename);


--
-- Name: sku_pack_day sku_pack_day_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sku_pack_day
    ADD CONSTRAINT sku_pack_day_pkey PRIMARY KEY (id);


--
-- Name: sku_pack_day sku_pack_day_sku_id_day_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sku_pack_day
    ADD CONSTRAINT sku_pack_day_sku_id_day_key UNIQUE (sku_id, day);


--
-- Name: sku_pack_material sku_pack_material_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sku_pack_material
    ADD CONSTRAINT sku_pack_material_pkey PRIMARY KEY (id);


--
-- Name: sku_packing_item sku_packing_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sku_packing_item
    ADD CONSTRAINT sku_packing_item_pkey PRIMARY KEY (id);


--
-- Name: sku_packing_item sku_packing_item_sku_id_packaging_id_per_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sku_packing_item
    ADD CONSTRAINT sku_packing_item_sku_id_packaging_id_per_key UNIQUE (sku_id, packaging_id, per);


--
-- Name: sku sku_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sku
    ADD CONSTRAINT sku_pkey PRIMARY KEY (id);


--
-- Name: sku sku_scenario_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sku
    ADD CONSTRAINT sku_scenario_id_code_key UNIQUE (scenario_id, code);


--
-- Name: tank_movement tank_movement_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tank_movement
    ADD CONSTRAINT tank_movement_pkey PRIMARY KEY (id);


--
-- Name: tank tank_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tank
    ADD CONSTRAINT tank_pkey PRIMARY KEY (id);


--
-- Name: tank tank_scenario_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tank
    ADD CONSTRAINT tank_scenario_id_code_key UNIQUE (scenario_id, code);


--
-- Name: tanker_trip tanker_trip_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tanker_trip
    ADD CONSTRAINT tanker_trip_pkey PRIMARY KEY (id);


--
-- Name: transport_run transport_run_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transport_run
    ADD CONSTRAINT transport_run_pkey PRIMARY KEY (id);


--
-- Name: transport_run transport_run_transporter_id_run_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transport_run
    ADD CONSTRAINT transport_run_transporter_id_run_date_key UNIQUE (transporter_id, run_date);


--
-- Name: transporter transporter_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transporter
    ADD CONSTRAINT transporter_pkey PRIMARY KEY (id);


--
-- Name: transporter_rate transporter_rate_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transporter_rate
    ADD CONSTRAINT transporter_rate_pkey PRIMARY KEY (id);


--
-- Name: transporter_rate transporter_rate_transporter_id_effective_from_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transporter_rate
    ADD CONSTRAINT transporter_rate_transporter_id_effective_from_key UNIQUE (transporter_id, effective_from);


--
-- Name: transporter transporter_scenario_id_section_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transporter
    ADD CONSTRAINT transporter_scenario_id_section_code_key UNIQUE (scenario_id, section, code);


--
-- Name: uom uom_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uom
    ADD CONSTRAINT uom_code_key UNIQUE (code);


--
-- Name: uom uom_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uom
    ADD CONSTRAINT uom_pkey PRIMARY KEY (id);


--
-- Name: vamaa_center vamaa_center_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vamaa_center
    ADD CONSTRAINT vamaa_center_pkey PRIMARY KEY (center);


--
-- Name: vamaa_collection vamaa_collection_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vamaa_collection
    ADD CONSTRAINT vamaa_collection_pkey PRIMARY KEY (id);


--
-- Name: vamaa_farmer vamaa_farmer_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vamaa_farmer
    ADD CONSTRAINT vamaa_farmer_pkey PRIMARY KEY (center, code);


--
-- Name: vamaa_sync_day vamaa_sync_day_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vamaa_sync_day
    ADD CONSTRAINT vamaa_sync_day_pkey PRIMARY KEY (center, day);


--
-- Name: bom_line_component_object_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bom_line_component_object_id_idx ON public.bom_line USING btree (component_object_id);


--
-- Name: bom_line_parent_object_id_sort_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bom_line_parent_object_id_sort_order_idx ON public.bom_line USING btree (parent_object_id, sort_order);


--
-- Name: bulk_batch_bulk_product_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bulk_batch_bulk_product_id_idx ON public.bulk_batch USING btree (bulk_product_id);


--
-- Name: bulk_batch_ingredient_batch_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bulk_batch_ingredient_batch_id_idx ON public.bulk_batch_ingredient USING btree (batch_id);


--
-- Name: bulk_batch_scenario_id_batch_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bulk_batch_scenario_id_batch_date_idx ON public.bulk_batch USING btree (scenario_id, batch_date DESC);


--
-- Name: bulk_product_scenario_id_sort_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bulk_product_scenario_id_sort_order_idx ON public.bulk_product USING btree (scenario_id, sort_order);


--
-- Name: change_log_scenario_id_changed_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX change_log_scenario_id_changed_at_idx ON public.change_log USING btree (scenario_id, changed_at DESC);


--
-- Name: change_log_table_name_record_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX change_log_table_name_record_id_idx ON public.change_log USING btree (table_name, record_id);


--
-- Name: cost_object_class_id_sort_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cost_object_class_id_sort_order_idx ON public.cost_object USING btree (class_id, sort_order);


--
-- Name: cost_object_parent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cost_object_parent_id_idx ON public.cost_object USING btree (parent_id);


--
-- Name: cost_object_scenario_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cost_object_scenario_id_idx ON public.cost_object USING btree (scenario_id);


--
-- Name: daily_material_use_day_id_product_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX daily_material_use_day_id_product_id_idx ON public.daily_material_use USING btree (day_id, product_id);


--
-- Name: daily_overhead_day_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX daily_overhead_day_id_idx ON public.daily_overhead USING btree (day_id);


--
-- Name: daily_product_cost_day_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX daily_product_cost_day_id_idx ON public.daily_product_cost USING btree (day_id);


--
-- Name: daily_product_cost_product_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX daily_product_cost_product_id_idx ON public.daily_product_cost USING btree (product_id);


--
-- Name: daily_production_day_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX daily_production_day_id_idx ON public.daily_production USING btree (day_id);


--
-- Name: demo_seed_tbl_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX demo_seed_tbl_idx ON public.demo_seed USING btree (tbl);


--
-- Name: dependency_edge_scenario_id_dst_ref_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dependency_edge_scenario_id_dst_ref_idx ON public.dependency_edge USING btree (scenario_id, dst_ref);


--
-- Name: dependency_edge_scenario_id_src_ref_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dependency_edge_scenario_id_src_ref_idx ON public.dependency_edge USING btree (scenario_id, src_ref);


--
-- Name: farmer_transporter_transporter_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX farmer_transporter_transporter_id_idx ON public.farmer_transporter USING btree (transporter_id);


--
-- Name: field_def_class_id_sort_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_def_class_id_sort_order_idx ON public.field_def USING btree (class_id, sort_order);


--
-- Name: field_def_scenario_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_def_scenario_id_idx ON public.field_def USING btree (scenario_id);


--
-- Name: field_group_scenario_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_group_scenario_id_idx ON public.field_group USING btree (scenario_id);


--
-- Name: field_value_field_def_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_value_field_def_id_idx ON public.field_value USING btree (field_def_id);


--
-- Name: field_value_object_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_value_object_id_idx ON public.field_value USING btree (object_id);


--
-- Name: milk_rate_chart_scenario_id_sort_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX milk_rate_chart_scenario_id_sort_order_idx ON public.milk_rate_chart USING btree (scenario_id, sort_order);


--
-- Name: object_class_scenario_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX object_class_scenario_id_idx ON public.object_class USING btree (scenario_id);


--
-- Name: parameter_scenario_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX parameter_scenario_id_idx ON public.parameter USING btree (scenario_id);


--
-- Name: plant_fuel_day_scenario_id_day_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX plant_fuel_day_scenario_id_day_idx ON public.plant_fuel_day USING btree (scenario_id, day DESC);


--
-- Name: procurement_batch_center_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX procurement_batch_center_id_idx ON public.procurement_batch USING btree (center_id);


--
-- Name: procurement_batch_rate_chart_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX procurement_batch_rate_chart_id_idx ON public.procurement_batch USING btree (rate_chart_id);


--
-- Name: procurement_batch_scenario_id_collected_on_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX procurement_batch_scenario_id_collected_on_idx ON public.procurement_batch USING btree (scenario_id, collected_on DESC);


--
-- Name: procurement_batch_trip_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX procurement_batch_trip_id_idx ON public.procurement_batch USING btree (trip_id);


--
-- Name: procurement_center_scenario_id_sort_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX procurement_center_scenario_id_sort_order_idx ON public.procurement_center USING btree (scenario_id, sort_order);


--
-- Name: production_day_scenario_id_day_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX production_day_scenario_id_day_idx ON public.production_day USING btree (scenario_id, day DESC);


--
-- Name: sku_pack_day_scenario_id_day_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sku_pack_day_scenario_id_day_idx ON public.sku_pack_day USING btree (scenario_id, day DESC);


--
-- Name: sku_pack_material_scenario_id_day_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sku_pack_material_scenario_id_day_idx ON public.sku_pack_material USING btree (scenario_id, day DESC);


--
-- Name: sku_pack_material_sku_id_day_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sku_pack_material_sku_id_day_idx ON public.sku_pack_material USING btree (sku_id, day);


--
-- Name: sku_packing_item_sku_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sku_packing_item_sku_id_idx ON public.sku_packing_item USING btree (sku_id);


--
-- Name: tank_movement_bulk_batch_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tank_movement_bulk_batch_id_idx ON public.tank_movement USING btree (bulk_batch_id) WHERE (bulk_batch_id IS NOT NULL);


--
-- Name: tank_movement_scenario_id_tank_id_movement_date_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tank_movement_scenario_id_tank_id_movement_date_created_at_idx ON public.tank_movement USING btree (scenario_id, tank_id, movement_date, created_at);


--
-- Name: tank_movement_source_ref_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tank_movement_source_ref_key ON public.tank_movement USING btree (scenario_id, source_ref) WHERE (source_ref IS NOT NULL);


--
-- Name: tank_movement_transfer_of_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tank_movement_transfer_of_key ON public.tank_movement USING btree (transfer_of) WHERE (transfer_of IS NOT NULL);


--
-- Name: tank_scenario_id_sort_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tank_scenario_id_sort_order_idx ON public.tank USING btree (scenario_id, sort_order);


--
-- Name: tanker_trip_scenario_id_trip_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tanker_trip_scenario_id_trip_date_idx ON public.tanker_trip USING btree (scenario_id, trip_date DESC);


--
-- Name: transport_run_scenario_id_run_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX transport_run_scenario_id_run_date_idx ON public.transport_run USING btree (scenario_id, run_date DESC);


--
-- Name: transporter_scenario_id_section_sort_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX transporter_scenario_id_section_sort_order_idx ON public.transporter USING btree (scenario_id, section, sort_order);


--
-- Name: vamaa_collection_center_day_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vamaa_collection_center_day_idx ON public.vamaa_collection USING btree (center, day);


--
-- Name: vamaa_collection_center_farmer_code_day_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vamaa_collection_center_farmer_code_day_idx ON public.vamaa_collection USING btree (center, farmer_code, day);


--
-- Name: bom_line bom_line_audit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER bom_line_audit AFTER INSERT OR DELETE OR UPDATE ON public.bom_line FOR EACH ROW EXECUTE FUNCTION public.log_change();


--
-- Name: bom_line bom_line_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER bom_line_touch BEFORE UPDATE ON public.bom_line FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: bulk_batch bulk_batch_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER bulk_batch_touch BEFORE UPDATE ON public.bulk_batch FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: bulk_product bulk_product_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER bulk_product_touch BEFORE UPDATE ON public.bulk_product FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: cost_object cost_object_audit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER cost_object_audit AFTER INSERT OR DELETE OR UPDATE ON public.cost_object FOR EACH ROW EXECUTE FUNCTION public.log_change();


--
-- Name: cost_object cost_object_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER cost_object_touch BEFORE UPDATE ON public.cost_object FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: diesel_price diesel_price_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER diesel_price_touch BEFORE UPDATE ON public.diesel_price FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: field_def field_def_audit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER field_def_audit AFTER INSERT OR DELETE OR UPDATE ON public.field_def FOR EACH ROW EXECUTE FUNCTION public.log_change();


--
-- Name: field_def field_def_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER field_def_touch BEFORE UPDATE ON public.field_def FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: field_value field_value_audit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER field_value_audit AFTER INSERT OR DELETE OR UPDATE ON public.field_value FOR EACH ROW EXECUTE FUNCTION public.log_change();


--
-- Name: field_value field_value_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER field_value_touch BEFORE UPDATE ON public.field_value FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: milk_rate_chart milk_rate_chart_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER milk_rate_chart_touch BEFORE UPDATE ON public.milk_rate_chart FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: object_class object_class_audit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER object_class_audit AFTER INSERT OR DELETE OR UPDATE ON public.object_class FOR EACH ROW EXECUTE FUNCTION public.log_change();


--
-- Name: object_class object_class_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER object_class_touch BEFORE UPDATE ON public.object_class FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: overhead_head overhead_head_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER overhead_head_touch BEFORE UPDATE ON public.overhead_head FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: parameter parameter_audit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER parameter_audit AFTER INSERT OR DELETE OR UPDATE ON public.parameter FOR EACH ROW EXECUTE FUNCTION public.log_change();


--
-- Name: parameter parameter_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER parameter_touch BEFORE UPDATE ON public.parameter FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: plant_fuel_day plant_fuel_day_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER plant_fuel_day_touch BEFORE UPDATE ON public.plant_fuel_day FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: procurement_batch procurement_batch_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER procurement_batch_touch BEFORE UPDATE ON public.procurement_batch FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: procurement_center procurement_center_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER procurement_center_touch BEFORE UPDATE ON public.procurement_center FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: production_day production_day_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER production_day_touch BEFORE UPDATE ON public.production_day FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: scenario scenario_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER scenario_touch BEFORE UPDATE ON public.scenario FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: sku_pack_day sku_pack_day_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sku_pack_day_touch BEFORE UPDATE ON public.sku_pack_day FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: tank_movement tank_movement_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tank_movement_touch BEFORE UPDATE ON public.tank_movement FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: tank tank_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tank_touch BEFORE UPDATE ON public.tank FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: tanker_trip tanker_trip_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tanker_trip_touch BEFORE UPDATE ON public.tanker_trip FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: transport_run transport_run_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER transport_run_touch BEFORE UPDATE ON public.transport_run FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: transporter_rate transporter_rate_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER transporter_rate_touch BEFORE UPDATE ON public.transporter_rate FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: transporter transporter_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER transporter_touch BEFORE UPDATE ON public.transporter FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: bom_line bom_line_component_object_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_line
    ADD CONSTRAINT bom_line_component_object_id_fkey FOREIGN KEY (component_object_id) REFERENCES public.cost_object(id) ON DELETE RESTRICT;


--
-- Name: bom_line bom_line_parent_object_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_line
    ADD CONSTRAINT bom_line_parent_object_id_fkey FOREIGN KEY (parent_object_id) REFERENCES public.cost_object(id) ON DELETE CASCADE;


--
-- Name: bom_line bom_line_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_line
    ADD CONSTRAINT bom_line_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id) ON DELETE CASCADE;


--
-- Name: bom_line bom_line_uom_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_line
    ADD CONSTRAINT bom_line_uom_id_fkey FOREIGN KEY (uom_id) REFERENCES public.uom(id) ON DELETE SET NULL;


--
-- Name: bulk_batch bulk_batch_bulk_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulk_batch
    ADD CONSTRAINT bulk_batch_bulk_product_id_fkey FOREIGN KEY (bulk_product_id) REFERENCES public.bulk_product(id) ON DELETE RESTRICT;


--
-- Name: bulk_batch_ingredient bulk_batch_ingredient_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulk_batch_ingredient
    ADD CONSTRAINT bulk_batch_ingredient_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.bulk_batch(id) ON DELETE CASCADE;


--
-- Name: bulk_batch_ingredient bulk_batch_ingredient_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulk_batch_ingredient
    ADD CONSTRAINT bulk_batch_ingredient_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.cost_object(id) ON DELETE SET NULL;


--
-- Name: bulk_batch bulk_batch_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulk_batch
    ADD CONSTRAINT bulk_batch_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id) ON DELETE CASCADE;


--
-- Name: bulk_product_ingredient bulk_product_ingredient_bulk_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulk_product_ingredient
    ADD CONSTRAINT bulk_product_ingredient_bulk_product_id_fkey FOREIGN KEY (bulk_product_id) REFERENCES public.bulk_product(id) ON DELETE CASCADE;


--
-- Name: bulk_product_ingredient bulk_product_ingredient_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulk_product_ingredient
    ADD CONSTRAINT bulk_product_ingredient_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.cost_object(id) ON DELETE CASCADE;


--
-- Name: bulk_product bulk_product_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulk_product
    ADD CONSTRAINT bulk_product_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id) ON DELETE CASCADE;


--
-- Name: calc_run calc_run_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calc_run
    ADD CONSTRAINT calc_run_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id) ON DELETE CASCADE;


--
-- Name: cost_object cost_object_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_object
    ADD CONSTRAINT cost_object_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.object_class(id) ON DELETE RESTRICT;


--
-- Name: cost_object cost_object_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_object
    ADD CONSTRAINT cost_object_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.cost_object(id) ON DELETE SET NULL;


--
-- Name: cost_object cost_object_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_object
    ADD CONSTRAINT cost_object_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id) ON DELETE CASCADE;


--
-- Name: cost_object cost_object_uom_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_object
    ADD CONSTRAINT cost_object_uom_id_fkey FOREIGN KEY (uom_id) REFERENCES public.uom(id) ON DELETE SET NULL;


--
-- Name: daily_material_use daily_material_use_day_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_material_use
    ADD CONSTRAINT daily_material_use_day_id_fkey FOREIGN KEY (day_id) REFERENCES public.production_day(id) ON DELETE CASCADE;


--
-- Name: daily_material_use daily_material_use_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_material_use
    ADD CONSTRAINT daily_material_use_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.cost_object(id) ON DELETE RESTRICT;


--
-- Name: daily_material_use daily_material_use_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_material_use
    ADD CONSTRAINT daily_material_use_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.cost_object(id) ON DELETE CASCADE;


--
-- Name: daily_overhead daily_overhead_day_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_overhead
    ADD CONSTRAINT daily_overhead_day_id_fkey FOREIGN KEY (day_id) REFERENCES public.production_day(id) ON DELETE CASCADE;


--
-- Name: daily_overhead daily_overhead_head_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_overhead
    ADD CONSTRAINT daily_overhead_head_id_fkey FOREIGN KEY (head_id) REFERENCES public.overhead_head(id) ON DELETE CASCADE;


--
-- Name: daily_product_cost daily_product_cost_day_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_product_cost
    ADD CONSTRAINT daily_product_cost_day_id_fkey FOREIGN KEY (day_id) REFERENCES public.production_day(id) ON DELETE CASCADE;


--
-- Name: daily_product_cost daily_product_cost_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_product_cost
    ADD CONSTRAINT daily_product_cost_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.cost_object(id) ON DELETE CASCADE;


--
-- Name: daily_production daily_production_day_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_production
    ADD CONSTRAINT daily_production_day_id_fkey FOREIGN KEY (day_id) REFERENCES public.production_day(id) ON DELETE CASCADE;


--
-- Name: daily_production daily_production_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_production
    ADD CONSTRAINT daily_production_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.cost_object(id) ON DELETE CASCADE;


--
-- Name: dependency_edge dependency_edge_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dependency_edge
    ADD CONSTRAINT dependency_edge_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id) ON DELETE CASCADE;


--
-- Name: diesel_price diesel_price_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diesel_price
    ADD CONSTRAINT diesel_price_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id) ON DELETE CASCADE;


--
-- Name: electricity_rate electricity_rate_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.electricity_rate
    ADD CONSTRAINT electricity_rate_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id) ON DELETE CASCADE;


--
-- Name: farmer_transporter farmer_transporter_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.farmer_transporter
    ADD CONSTRAINT farmer_transporter_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id) ON DELETE CASCADE;


--
-- Name: farmer_transporter farmer_transporter_transporter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.farmer_transporter
    ADD CONSTRAINT farmer_transporter_transporter_id_fkey FOREIGN KEY (transporter_id) REFERENCES public.transporter(id) ON DELETE CASCADE;


--
-- Name: field_def field_def_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_def
    ADD CONSTRAINT field_def_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.object_class(id) ON DELETE CASCADE;


--
-- Name: field_def field_def_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_def
    ADD CONSTRAINT field_def_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.field_group(id) ON DELETE SET NULL;


--
-- Name: field_def field_def_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_def
    ADD CONSTRAINT field_def_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id) ON DELETE CASCADE;


--
-- Name: field_def field_def_uom_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_def
    ADD CONSTRAINT field_def_uom_id_fkey FOREIGN KEY (uom_id) REFERENCES public.uom(id) ON DELETE SET NULL;


--
-- Name: field_group field_group_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_group
    ADD CONSTRAINT field_group_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.object_class(id) ON DELETE CASCADE;


--
-- Name: field_group field_group_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_group
    ADD CONSTRAINT field_group_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id) ON DELETE CASCADE;


--
-- Name: field_rollup_tag field_rollup_tag_field_def_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_rollup_tag
    ADD CONSTRAINT field_rollup_tag_field_def_id_fkey FOREIGN KEY (field_def_id) REFERENCES public.field_def(id) ON DELETE CASCADE;


--
-- Name: field_value field_value_field_def_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_value
    ADD CONSTRAINT field_value_field_def_id_fkey FOREIGN KEY (field_def_id) REFERENCES public.field_def(id) ON DELETE CASCADE;


--
-- Name: field_value field_value_object_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_value
    ADD CONSTRAINT field_value_object_id_fkey FOREIGN KEY (object_id) REFERENCES public.cost_object(id) ON DELETE CASCADE;


--
-- Name: field_value field_value_value_ref_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_value
    ADD CONSTRAINT field_value_value_ref_fkey FOREIGN KEY (value_ref) REFERENCES public.cost_object(id) ON DELETE SET NULL;


--
-- Name: milk_rate_chart milk_rate_chart_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.milk_rate_chart
    ADD CONSTRAINT milk_rate_chart_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id) ON DELETE CASCADE;


--
-- Name: milk_rate_grid_cell milk_rate_grid_cell_grid_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.milk_rate_grid_cell
    ADD CONSTRAINT milk_rate_grid_cell_grid_id_fkey FOREIGN KEY (grid_id) REFERENCES public.milk_rate_grid(id) ON DELETE CASCADE;


--
-- Name: milk_rate_grid milk_rate_grid_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.milk_rate_grid
    ADD CONSTRAINT milk_rate_grid_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id) ON DELETE CASCADE;


--
-- Name: object_class object_class_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.object_class
    ADD CONSTRAINT object_class_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id) ON DELETE CASCADE;


--
-- Name: overhead_head overhead_head_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overhead_head
    ADD CONSTRAINT overhead_head_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id) ON DELETE CASCADE;


--
-- Name: parameter parameter_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parameter
    ADD CONSTRAINT parameter_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id) ON DELETE CASCADE;


--
-- Name: parameter parameter_uom_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parameter
    ADD CONSTRAINT parameter_uom_id_fkey FOREIGN KEY (uom_id) REFERENCES public.uom(id) ON DELETE SET NULL;


--
-- Name: plant_fuel_day plant_fuel_day_fuel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plant_fuel_day
    ADD CONSTRAINT plant_fuel_day_fuel_id_fkey FOREIGN KEY (fuel_id) REFERENCES public.plant_fuel(id) ON DELETE CASCADE;


--
-- Name: plant_fuel_day plant_fuel_day_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plant_fuel_day
    ADD CONSTRAINT plant_fuel_day_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id) ON DELETE CASCADE;


--
-- Name: plant_fuel_rate plant_fuel_rate_fuel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plant_fuel_rate
    ADD CONSTRAINT plant_fuel_rate_fuel_id_fkey FOREIGN KEY (fuel_id) REFERENCES public.plant_fuel(id) ON DELETE CASCADE;


--
-- Name: plant_fuel plant_fuel_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plant_fuel
    ADD CONSTRAINT plant_fuel_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id) ON DELETE CASCADE;


--
-- Name: procurement_batch procurement_batch_center_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_batch
    ADD CONSTRAINT procurement_batch_center_id_fkey FOREIGN KEY (center_id) REFERENCES public.procurement_center(id) ON DELETE CASCADE;


--
-- Name: procurement_batch procurement_batch_rate_chart_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_batch
    ADD CONSTRAINT procurement_batch_rate_chart_id_fkey FOREIGN KEY (rate_chart_id) REFERENCES public.milk_rate_chart(id) ON DELETE RESTRICT;


--
-- Name: procurement_batch procurement_batch_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_batch
    ADD CONSTRAINT procurement_batch_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id) ON DELETE CASCADE;


--
-- Name: procurement_batch procurement_batch_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_batch
    ADD CONSTRAINT procurement_batch_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.tanker_trip(id) ON DELETE SET NULL;


--
-- Name: procurement_center procurement_center_rate_chart_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_center
    ADD CONSTRAINT procurement_center_rate_chart_id_fkey FOREIGN KEY (rate_chart_id) REFERENCES public.milk_rate_chart(id) ON DELETE SET NULL;


--
-- Name: procurement_center procurement_center_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_center
    ADD CONSTRAINT procurement_center_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id) ON DELETE CASCADE;


--
-- Name: production_day production_day_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_day
    ADD CONSTRAINT production_day_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id) ON DELETE CASCADE;


--
-- Name: scenario scenario_cloned_from_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario
    ADD CONSTRAINT scenario_cloned_from_id_fkey FOREIGN KEY (cloned_from_id) REFERENCES public.scenario(id) ON DELETE SET NULL;


--
-- Name: scenario scenario_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario
    ADD CONSTRAINT scenario_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.app_user(id) ON DELETE SET NULL;


--
-- Name: sku sku_bulk_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sku
    ADD CONSTRAINT sku_bulk_product_id_fkey FOREIGN KEY (bulk_product_id) REFERENCES public.bulk_product(id) ON DELETE SET NULL;


--
-- Name: sku_pack_day sku_pack_day_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sku_pack_day
    ADD CONSTRAINT sku_pack_day_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id) ON DELETE CASCADE;


--
-- Name: sku_pack_day sku_pack_day_sku_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sku_pack_day
    ADD CONSTRAINT sku_pack_day_sku_id_fkey FOREIGN KEY (sku_id) REFERENCES public.sku(id) ON DELETE CASCADE;


--
-- Name: sku_pack_material sku_pack_material_packaging_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sku_pack_material
    ADD CONSTRAINT sku_pack_material_packaging_id_fkey FOREIGN KEY (packaging_id) REFERENCES public.cost_object(id) ON DELETE SET NULL;


--
-- Name: sku_pack_material sku_pack_material_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sku_pack_material
    ADD CONSTRAINT sku_pack_material_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id) ON DELETE CASCADE;


--
-- Name: sku_pack_material sku_pack_material_sku_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sku_pack_material
    ADD CONSTRAINT sku_pack_material_sku_id_fkey FOREIGN KEY (sku_id) REFERENCES public.sku(id) ON DELETE CASCADE;


--
-- Name: sku_packing_item sku_packing_item_packaging_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sku_packing_item
    ADD CONSTRAINT sku_packing_item_packaging_id_fkey FOREIGN KEY (packaging_id) REFERENCES public.cost_object(id) ON DELETE CASCADE;


--
-- Name: sku_packing_item sku_packing_item_sku_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sku_packing_item
    ADD CONSTRAINT sku_packing_item_sku_id_fkey FOREIGN KEY (sku_id) REFERENCES public.sku(id) ON DELETE CASCADE;


--
-- Name: sku sku_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sku
    ADD CONSTRAINT sku_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id) ON DELETE CASCADE;


--
-- Name: tank_movement tank_movement_bulk_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tank_movement
    ADD CONSTRAINT tank_movement_bulk_batch_id_fkey FOREIGN KEY (bulk_batch_id) REFERENCES public.bulk_batch(id) ON DELETE CASCADE;


--
-- Name: tank_movement tank_movement_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tank_movement
    ADD CONSTRAINT tank_movement_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id) ON DELETE CASCADE;


--
-- Name: tank_movement tank_movement_tank_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tank_movement
    ADD CONSTRAINT tank_movement_tank_id_fkey FOREIGN KEY (tank_id) REFERENCES public.tank(id) ON DELETE CASCADE;


--
-- Name: tank_movement tank_movement_transfer_of_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tank_movement
    ADD CONSTRAINT tank_movement_transfer_of_fkey FOREIGN KEY (transfer_of) REFERENCES public.tank_movement(id) ON DELETE CASCADE;


--
-- Name: tank tank_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tank
    ADD CONSTRAINT tank_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id) ON DELETE CASCADE;


--
-- Name: tanker_trip tanker_trip_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tanker_trip
    ADD CONSTRAINT tanker_trip_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id) ON DELETE CASCADE;


--
-- Name: transport_run transport_run_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transport_run
    ADD CONSTRAINT transport_run_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id) ON DELETE CASCADE;


--
-- Name: transport_run transport_run_transporter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transport_run
    ADD CONSTRAINT transport_run_transporter_id_fkey FOREIGN KEY (transporter_id) REFERENCES public.transporter(id) ON DELETE CASCADE;


--
-- Name: transporter_rate transporter_rate_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transporter_rate
    ADD CONSTRAINT transporter_rate_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id) ON DELETE CASCADE;


--
-- Name: transporter_rate transporter_rate_transporter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transporter_rate
    ADD CONSTRAINT transporter_rate_transporter_id_fkey FOREIGN KEY (transporter_id) REFERENCES public.transporter(id) ON DELETE CASCADE;


--
-- Name: transporter transporter_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transporter
    ADD CONSTRAINT transporter_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenario(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict Y3npougunf02gx9OU2FdCZZ7L3uhVMPY9lN8i3VLgnzF1Q8n15XrQJRBJDpslrP

