"use server";

import { revalidatePath } from "next/cache";
import { pool, query } from "@/lib/db";
import { activeScenarioId } from "@/lib/model/load";
import { recompute } from "@/lib/model/recompute";
import { parse } from "@/lib/formula/parser";

export type ActionResult = { ok: true } | { ok: false; error: string };

const ok: ActionResult = { ok: true };
const fail = (error: string): ActionResult => ({ ok: false, error });

const SLUG = /^[a-z][a-z0-9_]*$/;

async function refresh(): Promise<void> {
  await recompute(await activeScenarioId(), "ui");
  revalidatePath("/", "layout");
}

/** Interprets what the user typed: "=..." is a formula, a bare number is a value. */
function readInput(raw: string, dataType = "number") {
  const text = raw.trim();
  if (text === "") return { formula: null, value_num: null, value_text: null };
  if (text.startsWith("=")) {
    parse(text); // throws on a bad formula, before anything is written
    return { formula: text.slice(1).trim(), value_num: null, value_text: null };
  }
  if (dataType === "text") return { formula: null, value_num: null, value_text: text };

  // "4%" is stored as 0.04, so a rate can be typed the way it is spoken
  const percent = text.endsWith("%");
  const n = Number((percent ? text.slice(0, -1) : text).replace(/,/g, ""));
  if (!Number.isFinite(n)) throw new Error(`"${text}" is not a number - start with "=" for a formula`);
  return { formula: null, value_num: percent ? n / 100 : n, value_text: null };
}

// ---------------------------------------------------------------- cells
export async function setCell(objectId: string, fieldId: string, raw: string): Promise<ActionResult> {
  try {
    const field = await query<{ data_type: string }>(
      `select data_type from field_def where id = $1`, [fieldId],
    );
    const v = readInput(raw, field[0]?.data_type);
    await query(
      `insert into field_value (object_id, field_def_id, formula, value_num, value_text)
       values ($1,$2,$3,$4,$5)
       on conflict (object_id, field_def_id) do update
         set formula = excluded.formula,
             value_num = excluded.value_num,
             value_text = excluded.value_text`,
      [objectId, fieldId, v.formula, v.value_num, v.value_text],
    );
    await refresh();
    return ok;
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}

/** Drops the override so the cell falls back to the class-level formula or default. */
export async function resetCell(objectId: string, fieldId: string): Promise<ActionResult> {
  try {
    await query(
      `update field_value set formula = null, value_num = null, value_text = null
        where object_id = $1 and field_def_id = $2`,
      [objectId, fieldId],
    );
    await refresh();
    return ok;
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}

// ---------------------------------------------------------------- parameters
export async function setParameter(id: string, raw: string): Promise<ActionResult> {
  try {
    const v = readInput(raw);
    await query(`update parameter set formula = $2, value_num = $3 where id = $1`,
      [id, v.formula, v.value_num]);
    await refresh();
    return ok;
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}

export async function addParameter(form: FormData): Promise<ActionResult> {
  try {
    const key = String(form.get("key") ?? "").trim();
    const label = String(form.get("label") ?? "").trim() || key;
    const group = String(form.get("group_name") ?? "").trim() || "General";
    if (!SLUG.test(key)) return fail("Key must be lower_snake_case, starting with a letter");
    const v = readInput(String(form.get("value") ?? ""));
    await query(
      `insert into parameter (scenario_id, key, label, group_name, formula, value_num, sort_order)
       values ($1,$2,$3,$4,$5,$6,(select coalesce(max(sort_order),0)+1 from parameter where scenario_id = $1))`,
      [await activeScenarioId(), key, label, group, v.formula, v.value_num],
    );
    await refresh();
    return ok;
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}

export async function deleteParameter(id: string): Promise<ActionResult> {
  try {
    await query(`delete from parameter where id = $1 and not is_locked`, [id]);
    await refresh();
    return ok;
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}

// ---------------------------------------------------------------- objects
export async function addObject(form: FormData): Promise<ActionResult> {
  try {
    const classId = String(form.get("class_id") ?? "");
    const code = String(form.get("code") ?? "").trim();
    const name = String(form.get("name") ?? "").trim() || code;
    if (!SLUG.test(code)) return fail("Code must be lower_snake_case, starting with a letter");
    await query(
      `insert into cost_object (scenario_id, class_id, code, name, sort_order)
       values ($1,$2,$3,$4,(select coalesce(max(sort_order),0)+1 from cost_object where class_id = $2))`,
      [await activeScenarioId(), classId, code, name],
    );
    await refresh();
    return ok;
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}

export async function updateObject(id: string, patch: { name?: string; notes?: string; is_active?: boolean }): Promise<ActionResult> {
  try {
    await query(
      `update cost_object
          set name = coalesce($2, name), notes = coalesce($3, notes),
              is_active = coalesce($4, is_active)
        where id = $1`,
      [id, patch.name ?? null, patch.notes ?? null, patch.is_active ?? null],
    );
    await refresh();
    return ok;
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}

export async function deleteObject(id: string): Promise<ActionResult> {
  try {
    const used = await query<{ code: string }>(
      `select p.code from bom_line b join cost_object p on p.id = b.parent_object_id
        where b.component_object_id = $1 limit 5`, [id],
    );
    if (used.length) {
      return fail(`Still used as a component by: ${used.map((u) => u.code).join(", ")}`);
    }
    await query(`delete from cost_object where id = $1`, [id]);
    await refresh();
    return ok;
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}

// ---------------------------------------------------------------- fields (columns)
export async function addField(form: FormData): Promise<ActionResult> {
  try {
    const classId = String(form.get("class_id") ?? "");
    const key = String(form.get("key") ?? "").trim();
    const label = String(form.get("label") ?? "").trim() || key;
    if (!SLUG.test(key)) return fail("Key must be lower_snake_case, starting with a letter");
    const raw = String(form.get("default") ?? "").trim();
    const v = readInput(raw);
    const rollupTag = String(form.get("rollup_tag") ?? "").trim();

    const sid = await activeScenarioId();
    const group = await query<{ id: string }>(
      `insert into field_group (scenario_id, class_id, code, label, sort_order)
       values ($1, $2, 'added', 'Added columns',
               (select coalesce(max(sort_order),0)+1 from field_group where class_id = $2))
       on conflict (class_id, code) do update set label = excluded.label
       returning id`,
      [sid, classId],
    );
    const rows = await query<{ id: string }>(
      `insert into field_def (scenario_id, class_id, key, label, default_formula, default_value,
                              group_id, sort_order)
       values ($1,$2,$3,$4,$5,$6,$7,
               (select coalesce(max(sort_order),0)+1 from field_def where class_id = $2))
       returning id`,
      [sid, classId, key, label, v.formula, v.value_num, group[0].id],
    );
    if (rollupTag) {
      await query(`insert into field_rollup_tag (field_def_id, tag) values ($1,$2)`,
        [rows[0].id, rollupTag]);
    }
    await refresh();
    return ok;
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}

export async function updateField(
  id: string,
  patch: { label?: string; default_formula?: string | null; decimals?: number; is_active?: boolean },
): Promise<ActionResult> {
  try {
    if (patch.default_formula) parse(patch.default_formula);
    await query(
      `update field_def
          set label = coalesce($2, label),
              default_formula = case when $3::text is null then default_formula
                                     when $3 = '' then null else $3 end,
              decimals = coalesce($4, decimals),
              is_active = coalesce($5, is_active)
        where id = $1`,
      [id, patch.label ?? null, patch.default_formula ?? null, patch.decimals ?? null, patch.is_active ?? null],
    );
    await refresh();
    return ok;
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}

export async function deleteField(id: string): Promise<ActionResult> {
  try {
    const field = await query<{ key: string; is_locked: boolean; class_id: string }>(
      `select key, is_locked, class_id from field_def where id = $1`, [id],
    );
    if (!field.length) return fail("Field not found");
    const referencing = await query<{ ref: string }>(
      `select dst_ref as ref from dependency_edge
        where scenario_id = $1 and src_ref like $2 limit 5`,
      [await activeScenarioId(), `%.${field[0].key}`],
    );
    if (referencing.length) {
      return fail(`Other formulas read this column: ${referencing.map((r) => r.ref).join(", ")}`);
    }
    await query(`delete from field_def where id = $1`, [id]);
    await refresh();
    return ok;
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}

// ---------------------------------------------------------------- BOM lines
export async function addBomLine(form: FormData): Promise<ActionResult> {
  try {
    const parentId = String(form.get("parent_object_id") ?? "");
    const componentId = String(form.get("component_object_id") ?? "");
    const label = String(form.get("label") ?? "").trim();
    const lineType = String(form.get("line_type") ?? "input");
    const qtyRaw = String(form.get("qty") ?? "1").trim();
    const qty = readInput(qtyRaw);
    if (!componentId && !label) return fail("Pick a component or give the line a label");
    await query(
      `insert into bom_line (scenario_id, parent_object_id, component_object_id, line_type, label,
                             qty, qty_formula, sort_order)
       values ($1,$2,$3,$4,$5,$6,$7,
               (select coalesce(max(sort_order),0)+1 from bom_line where parent_object_id = $2))`,
      [await activeScenarioId(), parentId, componentId || null, lineType, label || null,
       qty.value_num, qty.formula],
    );
    await refresh();
    return ok;
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}

export async function updateBomLine(
  id: string,
  column: "qty" | "rate" | "divisor" | "label" | "line_type" | "include_in_total",
  raw: string,
): Promise<ActionResult> {
  try {
    if (column === "label" || column === "line_type") {
      await query(`update bom_line set ${column} = $2 where id = $1`, [id, raw.trim() || null]);
    } else if (column === "include_in_total") {
      await query(`update bom_line set include_in_total = $2 where id = $1`, [id, raw === "true"]);
    } else {
      const v = readInput(raw);
      await query(
        `update bom_line set ${column} = $2, ${column}_formula = $3 where id = $1`,
        [id, v.value_num, v.formula],
      );
    }
    await refresh();
    return ok;
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}

export async function deleteBomLine(id: string): Promise<ActionResult> {
  try {
    await query(`delete from bom_line where id = $1`, [id]);
    await refresh();
    return ok;
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}

// ---------------------------------------------------------------- classes
export async function addClass(form: FormData): Promise<ActionResult> {
  try {
    const code = String(form.get("code") ?? "").trim();
    const name = String(form.get("name") ?? "").trim() || code;
    const plural = String(form.get("plural_name") ?? "").trim() || name;
    if (!SLUG.test(code)) return fail("Code must be lower_snake_case, starting with a letter");
    const sid = await activeScenarioId();
    const cls = await query<{ id: string }>(
      `insert into object_class (scenario_id, code, name, plural_name, sort_order)
       values ($1,$2,$3,$4,(select coalesce(max(sort_order),0)+1 from object_class where scenario_id = $1))
       returning id`,
      [sid, code, name, plural],
    );
    await query(
      `insert into field_group (scenario_id, class_id, code, label) values ($1,$2,'general','General')`,
      [sid, cls[0].id],
    );
    await refresh();
    return ok;
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}

export async function updateClass(id: string, patch: { name?: string; cost_field?: string }): Promise<ActionResult> {
  try {
    await query(
      `update object_class set name = coalesce($2, name), cost_field = coalesce($3, cost_field)
        where id = $1`,
      [id, patch.name ?? null, patch.cost_field ?? null],
    );
    await refresh();
    return ok;
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}

export async function deleteClass(id: string): Promise<ActionResult> {
  try {
    const objects = await query<{ n: number }>(
      `select count(*)::int as n from cost_object where class_id = $1`, [id],
    );
    if (objects[0].n > 0) return fail(`Delete its ${objects[0].n} row(s) first`);
    await query(`delete from object_class where id = $1`, [id]);
    await refresh();
    return ok;
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}

// ---------------------------------------------------------------- misc
export async function recalculate(): Promise<ActionResult> {
  try {
    await refresh();
    return ok;
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}

export async function cloneScenario(name: string): Promise<ActionResult> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const sid = await activeScenarioId();
    const code = `scn_${Date.now().toString(36)}`;
    const next = await client.query<{ id: string }>(
      `insert into scenario (code, name, description, status, cloned_from_id, currency, effective_from)
       select $2, $3, description, 'draft', id, currency, current_date from scenario where id = $1
       returning id`,
      [sid, code, name],
    );
    const nid = next.rows[0].id;

    await client.query(
      `insert into parameter (scenario_id, key, label, group_name, value_num, formula, uom_id,
                              min_value, max_value, decimals, suffix, description, is_locked, sort_order)
       select $2, key, label, group_name, value_num, formula, uom_id, min_value, max_value,
              decimals, suffix, description, is_locked, sort_order
         from parameter where scenario_id = $1`,
      [sid, nid],
    );
    await client.query(
      `create temp table class_map on commit drop as
       with ins as (
         insert into object_class (scenario_id, code, name, plural_name, description, allows_bom,
                                   cost_field, is_locked, color, sort_order)
         select $2, code, name, plural_name, description, allows_bom, cost_field, is_locked, color, sort_order
           from object_class where scenario_id = $1
         returning id, code)
       select ins.id as new_id, old.id as old_id
         from ins join object_class old on old.code = ins.code and old.scenario_id = $1`,
      [sid, nid],
    );
    await client.query(
      `create temp table group_map on commit drop as
       with ins as (
         insert into field_group (scenario_id, class_id, code, label, sort_order)
         select $2, m.new_id, g.code, g.label, g.sort_order
           from field_group g join class_map m on m.old_id = g.class_id
          where g.scenario_id = $1
         returning id, class_id, code)
       select ins.id as new_id, g.id as old_id
         from ins join class_map m on m.new_id = ins.class_id
         join field_group g on g.class_id = m.old_id and g.code = ins.code`,
      [sid, nid],
    );
    await client.query(
      `create temp table field_map on commit drop as
       with ins as (
         insert into field_def (scenario_id, class_id, key, label, data_type, group_id, uom_id,
                                default_value, default_text, default_formula, rollup_group, is_total,
                                is_locked, is_active, decimals, prefix, suffix, width, description, sort_order)
         select $2, m.new_id, f.key, f.label, f.data_type, gm.new_id, f.uom_id, f.default_value,
                f.default_text, f.default_formula, f.rollup_group, f.is_total, f.is_locked, f.is_active,
                f.decimals, f.prefix, f.suffix, f.width, f.description, f.sort_order
           from field_def f
           join class_map m on m.old_id = f.class_id
           left join group_map gm on gm.old_id = f.group_id
          where f.scenario_id = $1
         returning id, class_id, key)
       select ins.id as new_id, f.id as old_id
         from ins join class_map m on m.new_id = ins.class_id
         join field_def f on f.class_id = m.old_id and f.key = ins.key`,
      [sid, nid],
    );
    await client.query(
      `insert into field_rollup_tag (field_def_id, tag, sign)
       select fm.new_id, t.tag, t.sign from field_rollup_tag t
        join field_map fm on fm.old_id = t.field_def_id`,
    );
    await client.query(
      `create temp table object_map on commit drop as
       with ins as (
         insert into cost_object (scenario_id, class_id, code, name, uom_id, is_active, notes, tags, sort_order)
         select $2, m.new_id, o.code, o.name, o.uom_id, o.is_active, o.notes, o.tags, o.sort_order
           from cost_object o join class_map m on m.old_id = o.class_id
          where o.scenario_id = $1
         returning id, code)
       select ins.id as new_id, o.id as old_id
         from ins join cost_object o on o.code = ins.code and o.scenario_id = $1`,
      [sid, nid],
    );
    await client.query(
      `insert into field_value (object_id, field_def_id, formula, value_num, value_text, value_bool)
       select om.new_id, fm.new_id, v.formula, v.value_num, v.value_text, v.value_bool
         from field_value v
         join object_map om on om.old_id = v.object_id
         join field_map fm on fm.old_id = v.field_def_id`,
    );
    await client.query(
      `insert into bom_line (scenario_id, parent_object_id, component_object_id, line_type, label,
                             qty, qty_formula, uom_id, rate, rate_formula, divisor, divisor_formula,
                             loss_pct, amount_formula, include_in_total, notes, sort_order)
       select $1, pm.new_id, cm.new_id, b.line_type, b.label, b.qty, b.qty_formula, b.uom_id,
              b.rate, b.rate_formula, b.divisor, b.divisor_formula, b.loss_pct, b.amount_formula,
              b.include_in_total, b.notes, b.sort_order
         from bom_line b
         join object_map pm on pm.old_id = b.parent_object_id
         left join object_map cm on cm.old_id = b.component_object_id
        where b.scenario_id = $2`,
      [nid, sid],
    );
    await client.query("commit");
    await recompute(nid, "clone");
    revalidatePath("/", "layout");
    return ok;
  } catch (e) {
    await client.query("rollback");
    return fail(e instanceof Error ? e.message : String(e));
  } finally {
    client.release();
  }
}
