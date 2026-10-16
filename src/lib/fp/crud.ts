import { query } from "@/lib/db";
import { q, tableFor, type ModelCol, type ModelTable } from "./model";
import { labelColumn } from "./screens";

export interface FormField {
  field: string; col: string; label: string; sql: string; required: boolean;
  /** entity this uuid column points at, if it is a foreign key */
  ref?: string;
}
export interface Option { id: string; label: string }

const SKIP = new Set(["createdAt", "updatedAt", "uid"]);

const humanise = (f: string) =>
  f.replace(/Uid$/, "").replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());

/** Columns a person can fill in. Keys and timestamps are the database's job. */
export function formFields(t: ModelTable): FormField[] {
  return t.columns.filter((c) => !SKIP.has(c.field)).map((c) => ({
    field: c.field, col: c.col, label: humanise(c.field), sql: c.sql, required: c.required, ref: c.fk,
  }));
}

export async function optionsFor(entity: string): Promise<Option[]> {
  const t = tableFor(entity);
  if (!t) return [];
  const lc = labelColumn(t);
  const label = lc
    ? q(lc)
    : t.columns.some((c) => c.col === "first_name") ? `concat_ws(' ', "first_name", ${t.columns.some((c) => c.col === "last_name") ? '"last_name"' : "''"})`
    : `${q(t.pk)}::text`;
  return query<Option>(`select ${q(t.pk)}::text as id, ${label} as label from ${q(t.table)} order by 2 limit 1500`);
}

export async function optionsForFields(fields: FormField[]): Promise<Record<string, Option[]>> {
  const out: Record<string, Option[]> = {};
  await Promise.all([...new Set(fields.map((f) => f.ref).filter((r): r is string => !!r))].map(async (r) => { out[r] = await optionsFor(r); }));
  return out;
}

function coerce(f: ModelCol, raw: unknown): unknown {
  if (f.sql === "boolean") return raw === true || raw === "true" || raw === "on";
  const s = raw === null || raw === undefined ? "" : String(raw).trim();
  if (s === "") return null;
  switch (f.sql) {
    case "integer": case "bigint": {
      const n = Number(s.replace(/,/g, ""));
      if (!Number.isInteger(n)) throw new Error(`${humanise(f.field)}: "${s}" is not a whole number`);
      return n;
    }
    case "double precision": {
      const n = Number(s.replace(/,/g, ""));
      if (!Number.isFinite(n)) throw new Error(`${humanise(f.field)}: "${s}" is not a number`);
      return n;
    }
    case "uuid":
      if (!/^[0-9a-f-]{36}$/i.test(s)) throw new Error(`${humanise(f.field)}: pick one from the list`);
      return s;
    case "timestamptz":
      if (Number.isNaN(Date.parse(s))) throw new Error(`${humanise(f.field)}: not a valid date`);
      return s;
    case "jsonb":
      try { JSON.parse(s); } catch { throw new Error(`${humanise(f.field)}: must be valid JSON`); }
      return s;
    default:
      return s;
  }
}

export async function saveFpRow(entity: string, id: string | null, values: Record<string, unknown>): Promise<string> {
  const t = tableFor(entity);
  if (!t) throw new Error("Unknown record type");
  const cols = t.columns.filter((c) => !SKIP.has(c.field));
  const data: Record<string, unknown> = {};
  for (const c of cols) {
    if (!(c.field in values)) continue;
    const v = coerce(c, values[c.field]);
    if (v === null && c.required && c.sql !== "boolean") throw new Error(`${humanise(c.field)} is required`);
    if (v === null && !id) continue; // leave to the column default
    data[c.col] = v;
  }
  // a new row must supply every required column
  if (!id) for (const c of cols) if (c.required && c.sql !== "boolean" && !(c.col in data)) throw new Error(`${humanise(c.field)} is required`);
  const keys = Object.keys(data);
  const cast = (k: string) => (t.columns.find((c) => c.col === k)?.sql === "jsonb" ? "::jsonb" : "");
  try {
    if (id) {
      if (!keys.length) return id;
      const hasUpdated = t.columns.some((c) => c.field === "updatedAt");
      const rows = await query<{ id: string }>(
        `update ${q(t.table)} set ${keys.map((k, i) => `${q(k)} = $${i + 1}${cast(k)}`).join(", ")}${hasUpdated ? ', "updated_at" = now()' : ""} where ${q(t.pk)} = $${keys.length + 1} returning ${q(t.pk)}::text as id`,
        [...keys.map((k) => data[k]), id]);
      if (!rows.length) throw new Error("That record no longer exists");
      return rows[0].id;
    }
    const rows = await query<{ id: string }>(
      keys.length
        ? `insert into ${q(t.table)} (${keys.map(q).join(", ")}) values (${keys.map((k, i) => `$${i + 1}${cast(k)}`).join(", ")}) returning ${q(t.pk)}::text as id`
        : `insert into ${q(t.table)} default values returning ${q(t.pk)}::text as id`,
      keys.map((k) => data[k]));
    return rows[0].id;
  } catch (err) {
    throw friendly(err);
  }
}

export async function deleteFpRow(entity: string, id: string): Promise<void> {
  const t = tableFor(entity);
  if (!t) throw new Error("Unknown record type");
  try {
    await query(`delete from ${q(t.table)} where ${q(t.pk)} = $1`, [id]);
  } catch (err) {
    throw friendly(err);
  }
}

function friendly(err: unknown): Error {
  const code = (err as { code?: string }).code;
  if (code === "23505") return new Error("That already exists (a unique value is repeated).");
  if (code === "23503") return new Error("This record is linked to others - change or remove those first.");
  if (code === "23502") return new Error("A required value is missing.");
  if (code === "22P02") return new Error("One of the values has the wrong format.");
  return err instanceof Error ? err : new Error("Could not save");
}

/** One row with every form field, for the edit dialog. */
export async function getFpRow(entity: string, id: string): Promise<Record<string, string>> {
  const t = tableFor(entity);
  if (!t) throw new Error("Unknown record type");
  const cols = t.columns.filter((c) => !SKIP.has(c.field));
  const sel = cols.map((c) => `${q(c.col)}${c.sql === "timestamptz" ? "::text" : c.sql === "jsonb" ? "::text" : ""} as ${q(c.field)}`).join(", ");
  const rows = await query<Record<string, unknown>>(`select ${sel || "1"} from ${q(t.table)} where ${q(t.pk)} = $1`, [id]);
  if (!rows.length) throw new Error("That record no longer exists");
  const out: Record<string, string> = {};
  for (const c of cols) {
    const v = rows[0][c.field];
    out[c.field] = v === null || v === undefined ? "" : c.sql === "timestamptz" ? String(v).replace(" ", "T").slice(0, 16) : String(v);
  }
  return out;
}
