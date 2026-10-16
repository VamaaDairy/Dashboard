import "server-only";
import type { PoolClient } from "pg";
import { query, tx } from "@/lib/db";
import { DISPLAY_TZ } from "../constants";
import type { EntityDef, Field, MasterDef } from "../types";
import { explain, FormError, type Failure } from "./errors";
import { hooksFor } from "./hooks";
import { editableFields, readForm, validId, type FieldErrors, type Values } from "./validate";

export type Result = { ok: true; id: string } | ({ ok: false } & Failure);
export interface RefOption { value: string; label: string }
export interface FormData_ {
  refs: Record<string, RefOption[]>;
  suggestions: Record<string, string[]>;
}

const entityOf = (def: MasterDef): EntityDef => {
  if (!def.entity) throw new Error(`${def.slug} cannot be edited`);
  return def.entity;
};

// ---------------------------------------------------------------- reading

/** How a field is read back into the form as text. */
function selectExpr(f: Field): string {
  const c = `"${f.name}"`;
  if (f.jsonString) return `${c} #>> '{}'`;
  if (f.type === "date") return f.tz ? `(${c} at time zone '${DISPLAY_TZ}')::date::text` : `left(${c}::text, 10)`;
  if (f.type === "bool") return `coalesce(${c}, 0)::int::text`;
  return `${c}::text`;
}

/** The row's current values, as strings the form can show. Null when there is no such row. */
export async function loadRecord(def: MasterDef, id: string): Promise<Record<string, string | null> | null> {
  const e = entityOf(def);
  if (!validId(e, id)) return null;
  const cols = e.fields.filter((f) => !f.virtual);
  const rows = await query<Record<string, string | null>>(
    `select ${cols.map((f) => `${selectExpr(f)} as "${f.name}"`).join(", ")} from ${e.table} where "${e.idCol}" = $1`,
    [id],
  );
  return rows[0] ?? null;
}

/** Dropdown choices and hints for the form. */
export async function formOptions(def: MasterDef): Promise<FormData_> {
  const e = entityOf(def);
  const refs: FormData_["refs"] = {};
  const suggestions: FormData_["suggestions"] = {};
  await Promise.all(
    e.fields.map(async (f) => {
      if (f.ref) refs[f.name] = await query<RefOption>(f.ref);
      if (f.suggest) suggestions[f.name] = (await query<{ value: string }>(f.suggest)).map((r) => r.value);
    }),
  );
  return { refs, suggestions };
}

// ---------------------------------------------------------------- writing

const columnCache = new Map<string, Set<string>>();
async function columnsOf(client: PoolClient, table: string): Promise<Set<string>> {
  let set = columnCache.get(table);
  if (!set) {
    const r = await client.query(`select column_name from information_schema.columns where table_schema = 'public' and table_name = $1`, [table]);
    set = new Set(r.rows.map((x) => x.column_name as string));
    columnCache.set(table, set);
  }
  return set;
}

/** SQL placeholder and parameter for one column value. */
function bind(f: Field | undefined, value: unknown, n: number): { sql: string; arg: unknown } {
  if (f?.jsonString) return { sql: `$${n}::jsonb`, arg: value === null ? null : JSON.stringify(value) };
  if (f?.type === "date" && f.tz) return { sql: `$${n}::timestamptz`, arg: value === null ? null : `${value}T00:00:00+05:30` };
  return { sql: `$${n}`, arg: value };
}

async function audit(client: PoolClient, who: string, def: MasterDef, id: string, action: string, summary: string, before: unknown, after: unknown) {
  await client.query(
    `insert into master_audit (actor, slug, record_id, action, summary, before, after) values ($1, $2, $3, $4, $5, $6, $7)`,
    [who, def.slug, id, action, summary, before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null],
  );
}

const snapshot = async (client: PoolClient, e: EntityDef, id: string) =>
  (await client.query(`select to_jsonb(t) as row from ${e.table} t where "${e.idCol}" = $1`, [id])).rows[0]?.row ?? null;

/** What a row is called in messages: its first filled-in text field. */
const nameOf = (e: EntityDef, row: Record<string, unknown> | Values | null) => {
  const f = e.fields.find((x) => !x.virtual && x.type === "text" && row?.[x.name]);
  return f ? String(row?.[f.name]) : "";
};

/** Adds (id = null) or updates a row from the submitted form. */
export async function saveRecord(def: MasterDef, id: string | null, form: FormData, who: string): Promise<Result> {
  const e = entityOf(def);
  const isNew = id === null;
  if (!isNew && !validId(e, id)) return { ok: false, error: `That ${e.noun} no longer exists.` };

  const { values, errors } = readForm(e, form, isNew);
  if (Object.keys(errors).length) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: errors };

  try {
    return await tx(async (client): Promise<Result> => {
      const before = isNew ? null : await snapshot(client, e, id);
      if (!isNew && !before) return { ok: false, error: `That ${e.noun} no longer exists.` };

      // every chosen link must point at something that exists
      const bad: FieldErrors = {};
      for (const f of editableFields(e, isNew)) {
        const v = values[f.name];
        if (f.type !== "ref" || v === null || v === undefined) continue;
        const hit = await client.query(`select 1 from (${f.ref}) t where t.value = $1 limit 1`, [v]);
        if (!hit.rowCount) bad[f.name] = `${f.label}: pick one from the list`;
      }
      if (Object.keys(bad).length) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: bad };

      const hooks = hooksFor(def.slug);
      const hctx = { client, isNew, id, before };
      const extra = (await hooks.prepare?.(hctx, values)) ?? {};
      // a hook may fill in a link the form left empty (a new slab), so its columns win
      const written: Values = { ...values, ...extra };

      const have = await columnsOf(client, e.table);
      const cols: Array<{ name: string; field?: Field; value: unknown }> = [];
      for (const f of editableFields(e, isNew)) if (!f.virtual) cols.push({ name: f.name, field: f, value: written[f.name] });
      for (const [name, value] of Object.entries(extra)) if (!cols.some((c) => c.name === name)) cols.push({ name, field: e.fields.find((f) => f.name === name), value });
      if (isNew) for (const [name, value] of Object.entries(e.defaults ?? {})) if (!cols.some((c) => c.name === name)) cols.push({ name, value });
      if (e.actorCols) {
        const stamp = { name: who, from: "Dashboard" };
        if (have.has("updated_by")) cols.push({ name: "updated_by", value: JSON.stringify(stamp) });
        if (isNew && have.has("created_by")) cols.push({ name: "created_by", value: JSON.stringify({ name: who }) });
      }

      const args: unknown[] = [];
      const ph = cols.map((c) => {
        const b = bind(c.field, c.value, args.length + 1);
        args.push(b.arg);
        // the audit columns are jsonb
        return c.name === "updated_by" || c.name === "created_by" ? `${b.sql}::jsonb` : b.sql;
      });

      let savedId: string;
      if (isNew) {
        const r = await client.query(
          `insert into ${e.table} (${cols.map((c) => `"${c.name}"`).join(", ")}) values (${ph.join(", ")}) returning "${e.idCol}"::text as id`,
          args,
        );
        savedId = r.rows[0].id;
      } else {
        args.push(id);
        await client.query(
          `update ${e.table} set ${cols.map((c, i) => `"${c.name}" = ${ph[i]}`).join(", ")}, updated_at = now() where "${e.idCol}" = $${args.length}`,
          args,
        );
        savedId = id;
      }

      await hooks.after?.({ ...hctx, id: savedId }, written);
      const after = await snapshot(client, e, savedId);
      const label = nameOf(e, written) || nameOf(e, before);
      await audit(client, who, def, savedId, isNew ? "create" : "update", `${isNew ? "Added" : "Changed"} ${e.noun}${label ? ` "${label}"` : ""}`, before, after);
      return { ok: true, id: savedId };
    });
  } catch (err) {
    return { ok: false, ...explain(err, e, "save") };
  }
}

/** Switches a row off (or back on) without removing it. */
export async function setActive(def: MasterDef, id: string, activate: boolean, who: string): Promise<Result> {
  const e = entityOf(def);
  if (!e.active) return { ok: false, error: `A ${e.noun} cannot be deactivated - delete it instead.` };
  if (!validId(e, id)) return { ok: false, error: `That ${e.noun} no longer exists.` };
  const rule = e.active;
  try {
    return await tx(async (client): Promise<Result> => {
      const before = await snapshot(client, e, id);
      if (!before) return { ok: false, error: `That ${e.noun} no longer exists.` };
      const extra = activate ? rule.setOn : rule.setOff;
      await client.query(
        `update ${e.table} set "${rule.col}" = $1, updated_at = now()${extra ? `, ${extra}` : ""} where "${e.idCol}" = $2`,
        [activate ? rule.on : rule.off, id],
      );
      const label = nameOf(e, before);
      await audit(client, who, def, id, activate ? "activate" : "deactivate", `${activate ? "Reactivated" : "Deactivated"} ${e.noun}${label ? ` "${label}"` : ""}`, before, await snapshot(client, e, id));
      return { ok: true, id };
    });
  } catch (err) {
    return { ok: false, ...explain(err, e, "save") };
  }
}

/** Deletes a row for good - refused while anything else still uses it. */
export async function removeRecord(def: MasterDef, id: string, who: string): Promise<Result> {
  const e = entityOf(def);
  if (!validId(e, id)) return { ok: false, error: `That ${e.noun} no longer exists.` };
  try {
    return await tx(async (client): Promise<Result> => {
      const before = await snapshot(client, e, id);
      if (!before) return { ok: false, error: `That ${e.noun} no longer exists.` };

      const used: string[] = [];
      for (const u of e.usage ?? []) {
        const n = Number((await client.query(u.sql, [id])).rows[0]?.n ?? 0);
        if (n > 0) used.push(`${n.toLocaleString("en-IN")} ${u.label}`);
      }
      if (used.length) {
        const why = `This ${e.noun} is still used by ${used.join(", ")}.`;
        return { ok: false, error: e.active ? `${why} Deactivate it instead.` : `${why} Remove those first.` };
      }

      for (const sql of e.cleanup ?? []) await client.query(sql, [id]);
      await client.query(`delete from ${e.table} where "${e.idCol}" = $1`, [id]);
      const label = nameOf(e, before as Record<string, unknown>);
      await audit(client, who, def, id, "delete", `Deleted ${e.noun}${label ? ` "${label}"` : ""}`, before, null);
      return { ok: true, id };
    });
  } catch (err) {
    return { ok: false, ...explain(err, e, "delete") };
  }
}

export { FormError };
