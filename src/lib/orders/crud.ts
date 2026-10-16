import { query, one } from "@/lib/db";
import { entityOf, type Col, type Entity } from "./entities";

export type Row = Record<string, string | number | boolean | null> & { id: string };

export interface ListResult {
  rows: Row[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Option { id: string; label: string }

const colSql = (c: Col) =>
  c.type === "date" ? `to_char(t.${c.key}, 'YYYY-MM-DD') as ${c.key}`
  : c.type === "time" ? `to_char(t.${c.key}, 'HH24:MI') as ${c.key}`
  : `t.${c.key}`;

/** Columns the list/export shows: the entity's own, plus ticket_no style read-only ones. */
function selectList(e: Entity): string {
  const parts = [`t.id`, ...e.cols.map(colSql)];
  for (const c of e.cols) {
    if (c.type !== "ref" || !c.ref) continue;
    const r = entityOf(c.ref);
    parts.push(`(select ${r.label} from ${r.table} r where r.id = t.${c.key}) as ${c.key}__label`);
  }
  return parts.join(", ");
}

function whereOf(e: Entity, q: string, filters: Record<string, string>, params: unknown[]): string {
  const w: string[] = [];
  for (const [k, v] of Object.entries(e.fixed ?? {})) { params.push(v); w.push(`t.${k} = $${params.length}`); }
  for (const [k, v] of Object.entries(filters)) {
    const c = e.cols.find((x) => x.key === k);
    if (!c || v === "") continue;
    params.push(v);
    w.push(c.type === "bool" ? `t.${k} = ($${params.length} = 'true')` : `t.${k}::text = $${params.length}`);
  }
  const needle = q.trim();
  if (needle && e.search.length) {
    params.push(`%${needle}%`);
    w.push("(" + e.search.map((k) => `t.${k}::text ilike $${params.length}`).join(" or ") + ")");
  }
  return w.length ? `where ${w.join(" and ")}` : "";
}

export async function listRows(
  entityKey: string,
  opts: { q?: string; page?: number; pageSize?: number; filters?: Record<string, string> } = {},
): Promise<ListResult> {
  const e = entityOf(entityKey);
  const pageSize = opts.pageSize ?? 25;
  const page = Math.max(1, opts.page ?? 1);
  const params: unknown[] = [];
  const where = whereOf(e, opts.q ?? "", opts.filters ?? {}, params);
  const total = (await one<{ n: number }>(`select count(*)::int as n from ${e.table} t ${where}`, params))?.n ?? 0;
  const rows = await query<Row>(
    `select ${selectList(e)} from ${e.table} t ${where} order by ${e.order} limit ${pageSize} offset ${(page - 1) * pageSize}`,
    params,
  );
  return { rows, total, page, pageSize };
}

/** Every row, for CSV export. */
export async function allRows(entityKey: string): Promise<Row[]> {
  const e = entityOf(entityKey);
  const params: unknown[] = [];
  const where = whereOf(e, "", {}, params);
  return query<Row>(`select ${selectList(e)} from ${e.table} t ${where} order by ${e.order} limit 50000`, params);
}

export async function refOptions(entityKey: string): Promise<Option[]> {
  const e = entityOf(entityKey);
  const params: unknown[] = [];
  const w = Object.entries(e.fixed ?? {}).map(([k, v]) => { params.push(v); return `r.${k} = $${params.length}`; });
  return query<Option>(
    `select r.id, ${e.label} as label from ${e.table} r ${w.length ? "where " + w.join(" and ") : ""} order by 2 limit 2000`,
    params,
  );
}

/** Option lists for every ref column an entity uses, keyed by the referenced entity. */
export async function refsFor(entityKeys: string[]): Promise<Record<string, Option[]>> {
  const need = new Set<string>();
  for (const k of entityKeys) for (const c of entityOf(k).cols) if (c.type === "ref" && c.ref) need.add(c.ref);
  const out: Record<string, Option[]> = {};
  await Promise.all([...need].map(async (r) => { out[r] = await refOptions(r); }));
  return out;
}

function clean(c: Col, raw: unknown): string | number | boolean | null {
  if (c.type === "bool") return raw === true || raw === "true" || raw === "on";
  const s = raw === null || raw === undefined ? "" : String(raw).trim();
  if (s === "") {
    if (c.required) throw new Error(`${c.label} is required`);
    return null;
  }
  if (c.type === "number" || c.type === "money") {
    const n = Number(s.replace(/,/g, ""));
    if (!Number.isFinite(n)) throw new Error(`${c.label}: "${s}" is not a number`);
    return n;
  }
  if (c.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error(`${c.label}: use a date like 2026-04-30`);
  if (c.type === "time" && !/^\d{2}:\d{2}$/.test(s)) throw new Error(`${c.label}: use a time like 09:30`);
  if (c.type === "select" && c.options && !c.options.includes(s)) throw new Error(`${c.label}: "${s}" is not allowed`);
  if (c.type === "ref" && !/^[0-9a-f-]{36}$/i.test(s)) throw new Error(`${c.label}: pick one from the list`);
  return s;
}

export async function saveRow(entityKey: string, id: string | null, values: Record<string, unknown>): Promise<void> {
  const e = entityOf(entityKey);
  if (e.editable === false) throw new Error(`${e.title} cannot be edited here`);
  const cols = e.cols.filter((c) => !c.hideInForm);
  const data: Record<string, unknown> = {};
  for (const c of cols) data[c.key] = clean(c, values[c.key]);
  for (const [k, v] of Object.entries(e.fixed ?? {})) data[k] = v;
  const keys = Object.keys(data);
  const vals = keys.map((k) => data[k]);
  try {
    if (id) {
      await query(`update ${e.table} set ${keys.map((k, i) => `${k} = $${i + 1}`).join(", ")} where id = $${keys.length + 1}`, [...vals, id]);
    } else {
      await query(`insert into ${e.table} (${keys.join(", ")}) values (${keys.map((_, i) => `$${i + 1}`).join(", ")})`, vals);
    }
  } catch (err) {
    throw friendly(err, e);
  }
}

export async function deleteRow(entityKey: string, id: string): Promise<void> {
  const e = entityOf(entityKey);
  if (e.editable === false) throw new Error(`${e.title} cannot be edited here`);
  try {
    await query(`delete from ${e.table} where id = $1`, [id]);
  } catch (err) {
    throw friendly(err, e);
  }
}

function friendly(err: unknown, e: Entity): Error {
  const code = (err as { code?: string }).code;
  if (code === "23505") return new Error(`That ${e.singular} already exists (duplicate code or name).`);
  if (code === "23503") return new Error(`This ${e.singular} is used elsewhere - remove or change those first.`);
  if (code === "23514") return new Error(`One of the values is not allowed for a ${e.singular}.`);
  return err instanceof Error ? err : new Error("Could not save");
}
