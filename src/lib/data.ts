import "server-only";
import { query, one } from "./db";
import { activeScenarioId } from "./model/load";

export interface ClassSummary {
  id: string;
  code: string;
  name: string;
  plural_name: string | null;
  cost_field: string | null;
  object_count: number;
  sort_order: number;
}

export interface GridField {
  id: string;
  key: string;
  label: string;
  data_type: string;
  group_label: string | null;
  group_sort: number | null;
  default_formula: string | null;
  default_value: number | null;
  rollup_group: string | null;
  is_total: boolean;
  decimals: number;
  suffix: string | null;
  description: string | null;
  sort_order: number;
}

export interface GridCell {
  formula: string | null;
  overridden: boolean;
  input_num: number | null;
  input_text: string | null;
  computed_num: number | null;
  computed_text: string | null;
  error: string | null;
}

export interface GridRow {
  id: string;
  code: string;
  name: string;
  notes: string | null;
  is_active: boolean;
  cells: Record<string, GridCell>;
}

export const scenarioId = activeScenarioId;

export async function getScenario() {
  const id = await activeScenarioId();
  return one<{
    id: string; code: string; name: string; description: string | null;
    status: string; effective_from: string; currency: string;
  }>(`select id, code, name, description, status, effective_from, currency
        from scenario where id = $1`, [id]);
}

export async function getClasses(): Promise<ClassSummary[]> {
  const id = await activeScenarioId();
  return query<ClassSummary>(
    `select c.id, c.code, c.name, c.plural_name, c.cost_field, c.sort_order,
            count(o.id)::int as object_count
       from object_class c
       left join cost_object o on o.class_id = c.id
      where c.scenario_id = $1
      group by c.id
      order by c.sort_order, c.code`,
    [id],
  );
}

export async function getGrid(classCode: string) {
  const id = await activeScenarioId();
  const klass = await one<ClassSummary>(
    `select id, code, name, plural_name, cost_field, sort_order, 0 as object_count
       from object_class where scenario_id = $1 and code = $2`,
    [id, classCode],
  );
  if (!klass) return null;

  const fields = await query<GridField>(
    `select f.id, f.key, f.label, f.data_type, g.label as group_label, g.sort_order as group_sort,
            f.default_formula, f.default_value, f.rollup_group, f.is_total, f.decimals,
            f.suffix, f.description, f.sort_order
       from field_def f
       left join field_group g on g.id = f.group_id
      where f.class_id = $1 and f.is_active
      order by f.sort_order`,
    [klass.id],
  );

  const rows = await query<{
    id: string; code: string; name: string; notes: string | null; is_active: boolean;
    field_key: string; formula: string | null; formula_overridden: boolean;
    input_num: number | null; input_text: string | null;
    computed_num: number | null; computed_text: string | null; error: string | null;
  }>(
    `select o.id, o.code, o.name, o.notes, o.is_active,
            v.field_key, v.formula, v.formula_overridden, v.input_num, v.input_text,
            v.computed_num, v.computed_text, v.error
       from cost_object o
       left join v_cell v on v.object_id = o.id
      where o.class_id = $1
      order by o.sort_order, o.code`,
    [klass.id],
  );

  const byObject = new Map<string, GridRow>();
  for (const r of rows) {
    let row = byObject.get(r.id);
    if (!row) {
      row = { id: r.id, code: r.code, name: r.name, notes: r.notes, is_active: r.is_active, cells: {} };
      byObject.set(r.id, row);
    }
    if (r.field_key) {
      row.cells[r.field_key] = {
        formula: r.formula,
        overridden: r.formula_overridden,
        input_num: r.input_num,
        input_text: r.input_text,
        computed_num: r.computed_num,
        computed_text: r.computed_text,
        error: r.error,
      };
    }
  }

  return { klass, fields, rows: [...byObject.values()] };
}

export async function getParameters() {
  const id = await activeScenarioId();
  return query<{
    id: string; key: string; label: string; group_name: string;
    value_num: number | null; formula: string | null; computed_num: number | null;
    error: string | null; suffix: string | null; description: string | null;
    decimals: number; is_locked: boolean;
  }>(
    `select id, key, label, group_name, value_num, formula, computed_num, error,
            suffix, description, decimals, is_locked
       from parameter where scenario_id = $1 order by sort_order, key`,
    [id],
  );
}

export async function getObjectDetail(classCode: string, objectCode: string) {
  const id = await activeScenarioId();
  const object = await one<{
    id: string; code: string; name: string; notes: string | null;
    class_id: string; class_code: string; class_name: string; cost_field: string | null;
  }>(
    `select o.id, o.code, o.name, o.notes, o.class_id,
            c.code as class_code, c.name as class_name, c.cost_field
       from cost_object o
       join object_class c on c.id = o.class_id
      where o.scenario_id = $1 and c.code = $2 and o.code = $3`,
    [id, classCode, objectCode],
  );
  if (!object) return null;

  const [fields, cells, lines, components, usedBy] = await Promise.all([
    query<GridField>(
      `select f.id, f.key, f.label, f.data_type, g.label as group_label, g.sort_order as group_sort,
              f.default_formula, f.default_value, f.rollup_group, f.is_total, f.decimals,
              f.suffix, f.description, f.sort_order
         from field_def f
         left join field_group g on g.id = f.group_id
        where f.class_id = $1 and f.is_active
        order by f.sort_order`,
      [object.class_id],
    ),
    query<GridCell & { field_key: string }>(
      `select field_key, formula, formula_overridden as overridden, input_num, input_text,
              computed_num, computed_text, error
         from v_cell where object_id = $1`,
      [object.id],
    ),
    query<{
      id: string; line_type: string; label: string | null; component_code: string | null;
      component_name: string | null; qty: number | null; qty_formula: string | null;
      rate: number | null; rate_formula: string | null; divisor: number;
      divisor_formula: string | null; computed_amount: number | null; error: string | null;
      include_in_total: boolean; notes: string | null; sort_order: number;
    }>(
      `select b.id, b.line_type, b.label, c.code as component_code, c.name as component_name,
              b.qty, b.qty_formula, b.rate, b.rate_formula, b.divisor, b.divisor_formula,
              b.computed_amount, b.error, b.include_in_total, b.notes, b.sort_order
         from bom_line b
         left join cost_object c on c.id = b.component_object_id
        where b.parent_object_id = $1
        order by b.sort_order`,
      [object.id],
    ),
    query<{ id: string; code: string; name: string; class_name: string }>(
      `select o.id, o.code, o.name, c.name as class_name
         from cost_object o join object_class c on c.id = o.class_id
        where o.scenario_id = $1 and o.id <> $2
        order by c.sort_order, o.sort_order`,
      [id, object.id],
    ),
    query<{ dst_ref: string }>(
      `select distinct dst_ref from dependency_edge
        where scenario_id = $1 and src_ref like $2 order by dst_ref limit 200`,
      [id, `field:${object.code}.%`],
    ),
  ]);

  const cellMap: Record<string, GridCell> = {};
  for (const c of cells) cellMap[c.field_key] = c;

  return { object, fields, cells: cellMap, lines, components, usedBy: usedBy.map((u) => u.dst_ref) };
}

export async function getSchema() {
  const id = await activeScenarioId();
  const classes = await query<ClassSummary>(
    `select c.id, c.code, c.name, c.plural_name, c.cost_field, c.sort_order,
            count(o.id)::int as object_count
       from object_class c
       left join cost_object o on o.class_id = c.id
      where c.scenario_id = $1
      group by c.id order by c.sort_order`,
    [id],
  );
  const fields = await query<GridField & { class_id: string; is_locked: boolean; usage: number }>(
    `select f.id, f.class_id, f.key, f.label, f.data_type, g.label as group_label,
            g.sort_order as group_sort, f.default_formula, f.default_value, f.rollup_group,
            f.is_total, f.is_locked, f.decimals, f.suffix, f.description, f.sort_order,
            (select count(*)::int from field_value v
              where v.field_def_id = f.id and (v.formula is not null or v.value_num is not null
                                               or v.value_text is not null)) as usage
       from field_def f
       left join field_group g on g.id = f.group_id
      where f.scenario_id = $1 and f.is_active
      order by f.sort_order`,
    [id],
  );
  return classes.map((c) => ({ ...c, fields: fields.filter((f) => f.class_id === c.id) }));
}

export async function getImpact(ref: string) {
  const id = await activeScenarioId();
  return query<{ ref: string; depth: number }>(
    `select ref, depth from impact_of($1, $2) order by depth, ref limit 300`,
    [id, ref],
  );
}

/** Human edits only - the seed load would otherwise bury them. */
export async function getChangeLog(limit = 200) {
  const id = await activeScenarioId();
  return query<{
    id: string; table_name: string; action: string; changed_at: string;
    actor: string | null; ref: string | null;
    old_row: Record<string, unknown> | null;
    new_row: Record<string, unknown> | null;
  }>(
    `select cl.id, cl.table_name, cl.action, cl.changed_at, cl.actor, cl.old_row, cl.new_row,
            coalesce(
              cell_object.code || '.' || cell_field.key,
              object.code,
              param.key,
              field.class_code || '.' || field.key,
              line_parent.code || ' BOM'
            ) as ref
       from change_log cl
       left join cost_object cell_object
              on cell_object.id = (coalesce(cl.new_row, cl.old_row) ->> 'object_id')::uuid
       left join field_def cell_field
              on cell_field.id = (coalesce(cl.new_row, cl.old_row) ->> 'field_def_id')::uuid
       left join cost_object object
              on cl.table_name = 'cost_object' and object.id = cl.record_id
       left join parameter param
              on cl.table_name = 'parameter' and param.id = cl.record_id
       left join (select f.id, f.key, c.code as class_code
                    from field_def f join object_class c on c.id = f.class_id) field
              on cl.table_name = 'field_def' and field.id = cl.record_id
       left join cost_object line_parent
              on line_parent.id = (coalesce(cl.new_row, cl.old_row) ->> 'parent_object_id')::uuid
      where cl.scenario_id = $1
        and coalesce(cl.actor, '') <> 'seed'
      order by cl.changed_at desc, cl.id desc
      limit $2`,
    [id, limit],
  );
}

export async function getLastCalc() {
  const id = await activeScenarioId();
  return one<{
    status: string; node_count: number | null; error_count: number;
    duration_ms: number | null; finished_at: string | null;
  }>(
    `select status, node_count, error_count, duration_ms, finished_at
       from calc_run where scenario_id = $1 order by started_at desc limit 1`,
    [id],
  );
}
