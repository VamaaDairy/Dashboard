import { query, one } from "@/lib/db";
import { q } from "./model";
import type { Join, Screen, ScreenCol } from "./screens";

export type Cell = string | number | boolean | null | Record<string, unknown> | unknown[];
export interface GridRow { _id: string; [key: string]: Cell }
export interface GridParams {
  q?: string; page?: number; pageSize?: number; sort?: string; dir?: "asc" | "desc"; values?: Record<string, string>;
}
export interface GridResult { rows: GridRow[]; total: number; page: number; pageSize: number }

function joinsSql(joins: Join[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const j of joins) {
    if (seen.has(j.alias)) continue;
    seen.add(j.alias);
    out.push(`left join ${q(j.table)} ${j.alias} on ${j.alias}.${q(j.toPk)} = ${j.from}.${q(j.fromCol)}`);
  }
  return out.join(" ");
}

function whereOf(s: Screen, p: GridParams, params: unknown[]): string {
  const w: string[] = s.where ? [`(${s.where})`] : [];
  const v = p.values ?? {};
  for (const f of s.filters) {
    const val = (v[f.key] ?? "").trim();
    if (!val) continue;
    if (f.kind === "from" || f.kind === "to" || f.kind === "day") {
      const de = s.dateExpr ?? (s.dateCol ? `t.${q(s.dateCol)}` : null);
      if (!de || !/^\d{4}-\d{2}-\d{2}$/.test(val)) continue;
      params.push(val);
      const n = params.length;
      w.push(f.kind === "from" ? `${de} >= $${n}::date` : f.kind === "to" ? `${de} < $${n}::date + 1` : `${de}::date = $${n}::date`);
    } else if (f.colKey) {
      const c = s.cols.find((x) => x.key === f.colKey);
      if (!c) continue;
      params.push(f.kind === "status" ? val : `%${val}%`);
      w.push(f.kind === "status" ? `${c.expr}::text = $${params.length}` : `${c.expr}::text ilike $${params.length}`);
    }
  }
  const needle = (p.q ?? "").trim();
  if (needle) {
    const textCols = s.cols.filter((c) => c.sql === "text").slice(0, 8);
    if (textCols.length) {
      params.push(`%${needle}%`);
      w.push("(" + textCols.map((c) => `${c.expr} ilike $${params.length}`).join(" or ") + ")");
    }
  }
  return w.length ? `where ${w.join(" and ")}` : "";
}

export async function runGrid(s: Screen, p: GridParams = {}): Promise<GridResult> {
  if (!s.table) return { rows: [], total: 0, page: 1, pageSize: 25 };
  const pageSize = p.pageSize ?? 25;
  const page = Math.max(1, p.page ?? 1);
  const joins = s.cols.flatMap((c) => c.joins);
  const params: unknown[] = [];
  const where = whereOf(s, p, params);
  const from = `from ${q(s.table.table)} t ${joinsSql(joins)}`;
  const total = (await one<{ n: number }>(`select count(*)::int as n ${from} ${where}`, params))?.n ?? 0;

  const sortCol = s.cols.find((c) => c.key === p.sort);
  const order = sortCol
    ? `${sortCol.expr} ${p.dir === "desc" ? "desc" : "asc"} nulls last`
    : s.order ? s.order
    : s.dateExpr ? `${s.dateExpr} desc nulls last`
    : s.dateCol ? `t.${q(s.dateCol)} desc nulls last`
    : s.table.columns.some((c) => c.col === "created_at") ? `t."created_at" desc` : `t.${q(s.table.pk)}`;
  const select = [`t.${q(s.table.pk)}::text as _id`, ...(s.statusExpr ? [`(${s.statusExpr})::text as _status`] : []), ...s.cols.map((c) => `${c.expr} as ${c.key}`)].join(", ");
  const rows = await query<GridRow>(
    `select ${select} ${from} ${where} order by ${order}, t.${q(s.table.pk)} limit ${pageSize} offset ${(page - 1) * pageSize}`, params);
  return { rows: rows.map(normalise), total, page, pageSize };
}

/** Dates arrive as Date objects: keep them as ISO strings so they cross the server / client boundary cleanly. */
function normalise(r: GridRow): GridRow {
  for (const k of Object.keys(r)) {
    const v = r[k] as unknown;
    if (v instanceof Date) r[k] = v.toISOString();
  }
  return r;
}

export async function allGridRows(s: Screen, p: GridParams = {}): Promise<GridRow[]> {
  return (await runGrid(s, { ...p, page: 1, pageSize: 50000 })).rows;
}

/** Distinct values of a column, for a status / select filter. */
export async function distinctValues(s: Screen, col: ScreenCol): Promise<string[]> {
  if (!s.table) return [];
  const rows = await query<{ v: string | null }>(
    `select distinct ${col.expr}::text as v from ${q(s.table.table)} t ${joinsSql(col.joins)} where ${col.expr} is not null order by 1 limit 60`);
  return rows.map((r) => r.v ?? "").filter(Boolean);
}
