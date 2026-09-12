import { query } from "@/lib/db";
import type { Snapshot } from "./types";

export async function loadSnapshot(scenarioId: string): Promise<Snapshot> {
  const [parameters, classes, fields, rollupTags, objects, values, bomLines] = await Promise.all([
    query<Snapshot["parameters"][number]>(`select id, key, label, group_name, value_num, formula, uom_id, decimals,
                  description, is_locked, sort_order
             from parameter where scenario_id = $1 order by sort_order, key`, [scenarioId]),
    query<Snapshot["classes"][number]>(`select id, code, name, plural_name, description, allows_bom, cost_field,
                  is_locked, sort_order
             from object_class where scenario_id = $1 order by sort_order, code`, [scenarioId]),
    query<Snapshot["fields"][number]>(`select id, class_id, key, label, data_type, group_id, uom_id, default_value,
                  default_text, default_formula, rollup_group, is_total, is_locked,
                  is_active, decimals, prefix, suffix, description, sort_order
             from field_def where scenario_id = $1 order by sort_order, key`, [scenarioId]),
    query<Snapshot["rollupTags"][number]>(`select t.field_def_id, t.tag, t.sign
             from field_rollup_tag t
             join field_def f on f.id = t.field_def_id
            where f.scenario_id = $1`, [scenarioId]),
    query<Snapshot["objects"][number]>(`select id, class_id, code, name, parent_id, uom_id, is_active, notes, sort_order
             from cost_object where scenario_id = $1 order by sort_order, code`, [scenarioId]),
    query<Snapshot["values"][number]>(`select v.object_id, v.field_def_id, v.formula, v.value_num, v.value_text
             from field_value v
             join cost_object o on o.id = v.object_id
            where o.scenario_id = $1`, [scenarioId]),
    query<Snapshot["bomLines"][number]>(`select id, parent_object_id, component_object_id, line_type, label, qty, qty_formula,
                  rate, rate_formula, divisor, divisor_formula, loss_pct, amount_formula,
                  include_in_total, notes, sort_order
             from bom_line where scenario_id = $1 order by parent_object_id, sort_order`, [scenarioId]),
  ]);

  return { scenarioId, parameters, classes, fields, rollupTags, objects, values, bomLines };
}

export async function activeScenarioId(): Promise<string> {
  const rows = await query<{ id: string }>(
    `select id from scenario order by (status = 'active') desc, created_at desc limit 1`,
  );
  if (!rows.length) throw new Error("No scenario found - run `npm run db:seed`");
  return rows[0].id;
}
