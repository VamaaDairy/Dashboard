import { MODEL, ROUTES, tableFor, type ModelTable, type SpecComp, type SpecRoute } from "./model";
import { OVERRIDES } from "./overrides";

/**
 * A route's list screen worked out from the spec: which table its grid reads,
 * which spec grid columns resolve to real columns (following belongs-to links,
 * e.g. staff.state.region), and which form fields are filters.
 */
export interface Join { alias: string; table: string; from: string; fromCol: string; toPk: string }
export interface ScreenCol {
  key: string;            // c0, c1... select alias
  label: string;
  path: string;           // spec path, e.g. staff.state.region
  expr: string;           // SQL expression
  sql: string;            // column type
  joins: Join[];
}
export type FilterKind = "from" | "to" | "day" | "status" | "text";
export interface ScreenFilter { key: string; label: string; kind: FilterKind; colKey?: string }
/** Hand-written adjustments to what the spec parser worked out for a route. */
export interface ColDef { label: string; path?: string; sql?: string; type?: string }
export interface Override {
  entity?: string;
  /** SQL condition on alias t that every row of this screen satisfies (e.g. only primary sales) */
  where?: string;
  /** SQL expression the From / To / Date filters apply to, when the date is not a plain timestamp column */
  dateExpr?: string;
  cols?: ColDef[];
  /** spec labels to drop from the automatic column list */
  hide?: string[];
  editable?: boolean;
  title?: string;
  order?: string;
  /** SQL giving each row's status, which decides which row buttons show (see rowActions.ts) */
  statusExpr?: string;
}

export interface Screen {
  route: SpecRoute;
  comp: SpecComp | null;
  table: ModelTable | null;
  cols: ScreenCol[];
  skipped: number;         // spec columns that need computed logic and are not plain columns
  filters: ScreenFilter[];
  dateCol: string | null;  // column filtered by From / To
  buttons: string[];
  tabs: string[];
  /** the spec shows add / update controls, so rows of this table can be created and edited here */
  editable: boolean;
  where: string | null;
  dateExpr: string | null;
  order: string | null;
  statusExpr: string | null;
}

const NOISE = /^(no|sr\.? ?no\.?|s\.?no\.?|#|sl\.? ?no\.?|\s*)$/i;
const ACTION_LABELS = /^(update|edit|delete|view|action|actions|download|print|details?|change|reset|map|select|view details)$/i;

function look(tbl: ModelTable, seg: string) {
  return tbl.columns.find((c) => c.field === seg);
}

/** Display column of a table, for when a path ends on a relation (e.g. `staff` -> name). */
const LABEL_FIELDS = ["name", "firstName", "skuName", "title", "beatName", "channel", "designation", "state", "activityName", "invoiceNumber", "label", "code"];
export function labelColumn(tbl: ModelTable): string | null {
  for (const f of LABEL_FIELDS) { const c = look(tbl, f); if (c && c.sql === "text") return c.col; }
  return null;
}

export function resolvePath(entity: ModelTable, path: string): { expr: string; sql: string; joins: Join[] } | null {
  const segs = path.split(".").filter(Boolean);
  if (!segs.length) return null;
  let cur = entity;
  let alias = "t";
  const joins: Join[] = [];
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    const last = i === segs.length - 1;
    const c = look(cur, seg);
    if (last && c) return { expr: `${alias}."${c.col}"`, sql: c.sql, joins };
    const rel = cur.relations[seg];
    if (!rel) return null;
    const next = tableFor(rel.target);
    if (!next) return null;
    const fromCol = look(cur, rel.fk)?.col;
    if (!fromCol) return null;
    const a = `j_${segs.slice(0, i + 1).join("_")}`.replace(/[^a-zA-Z0-9_]/g, "_");
    if (!joins.some((j) => j.alias === a)) joins.push({ alias: a, table: next.table, from: alias, fromCol, toPk: next.pk });
    alias = a;
    cur = next;
    if (last) {
      const lc = labelColumn(next);
      return lc ? { expr: `${alias}."${lc}"`, sql: "text", joins } : null;
    }
  }
  return null;
}

function returnedEntities(r: SpecRoute): string[] {
  const out = new Set<string>();
  for (const a of r.apis) for (const m of a.returns.matchAll(/([A-Za-z][A-Za-z0-9]*)/g)) if (tableFor(m[1])) out.add(m[1]);
  for (const k of Object.keys(r.shapes)) if (tableFor(k)) out.add(k);
  return [...out];
}

function primary(r: SpecRoute): SpecComp | null {
  const withCols = r.components.filter((c) => c.gridColumns.length);
  if (withCols.length) return withCols.reduce((a, b) => (b.gridColumns.length > a.gridColumns.length ? b : a));
  return r.components.find((c) => c.formFields.length) ?? r.components[0] ?? null;
}

function pickEntity(comp: SpecComp | null, r: SpecRoute): ModelTable | null {
  const fields = (comp?.gridColumns ?? []).map((c) => c.field).filter((f): f is string => !!f);
  const score = (t: ModelTable) => fields.filter((f) => resolvePath(t, f)).length;
  const boosted = returnedEntities(r).map((n) => tableFor(n)!).filter(Boolean);
  let best: ModelTable | null = null;
  let bestScore = -1;
  for (const t of boosted) { const s = score(t) + 2; if (s > bestScore) { best = t; bestScore = s; } }
  if (!best || bestScore <= 2) {
    for (const t of Object.values(MODEL)) { const s = score(t); if (s > bestScore) { best = t; bestScore = s; } }
  }
  return best;
}

const DATE_PREF = ["scheduledTime", "startTime", "invoiceDate", "orderDate", "date", "paymentDate", "createdAt"];

const cache = new Map<string, Screen>();

export function screenFor(routeKey: string): Screen | null {
  const hit = cache.get(routeKey);
  if (hit) return hit;
  const route = ROUTES.find((x) => x.key === routeKey);
  if (!route) return null;
  const comp = primary(route);
  const ov = OVERRIDES[routeKey];
  const table = ov?.entity ? tableFor(ov.entity) ?? null : pickEntity(comp, route);
  const cols: ScreenCol[] = [];
  let skipped = 0;
  const seen = new Set<string>();
  if (table && ov?.cols) {
    for (const d of ov.cols) {
      if (d.sql) { cols.push({ key: `c${cols.length}`, label: d.label, path: d.label, expr: `(${d.sql})`, sql: d.type ?? "text", joins: [] }); continue; }
      const res = d.path ? resolvePath(table, d.path) : null;
      if (!res) { skipped++; continue; }
      cols.push({ key: `c${cols.length}`, label: d.label, path: d.path!, expr: res.expr, sql: d.type ?? res.sql, joins: res.joins });
    }
  } else if (table && comp) {
    for (const c of comp.gridColumns) {
      if (!c.field || NOISE.test(c.label) || ACTION_LABELS.test(c.label) || ov?.hide?.includes(c.label)) continue;
      if (seen.has(c.field)) continue;
      const res = resolvePath(table, c.field);
      if (!res) { skipped++; continue; }
      seen.add(c.field);
      cols.push({ key: `c${cols.length}`, label: c.label || c.field, path: c.field, expr: res.expr, sql: res.sql, joins: res.joins });
    }
  }
  const dateField = ov?.dateExpr ? undefined : table ? DATE_PREF.map((f) => look(table, f)).find(Boolean) : undefined;
  const filters: ScreenFilter[] = [];
  for (const [i, label] of (comp?.formFields ?? []).entries()) {
    const l = label.toLowerCase().trim();
    const key = `f${i}`;
    if (/^(from|start date|from date)\b/.test(l)) filters.push({ key, label, kind: "from" });
    else if (/^(to|end date|to date)\b/.test(l)) filters.push({ key, label, kind: "to" });
    else if (/^(date|filter date|month)$/.test(l)) filters.push({ key, label, kind: "day" });
    else {
      const base = l.replace(/\b(filter|by|select|search|name)\b/g, "").replace(/\s+/g, " ").trim();
      const col = cols.find((c) => c.label.toLowerCase() === l) ?? cols.find((c) => base && c.label.toLowerCase().includes(base));
      if (col) filters.push({ key, label, kind: /status/.test(l) ? "status" : "text", colKey: col.key });
    }
  }
  const s: Screen = {
    route, comp, table, cols, skipped, filters, dateCol: dateField?.col ?? null,
    buttons: comp?.buttons ?? [], tabs: comp?.tabs ?? [],
    where: ov?.where ?? null, dateExpr: ov?.dateExpr ?? null, order: ov?.order ?? null, statusExpr: ov?.statusExpr ?? null,
    editable: ov?.editable ?? (!!table && (((comp?.buttons ?? []).some((b) => /(add|create|new|save|update|edit)/i.test(b))) || (comp?.gridColumns ?? []).some((c) => /^(update|edit|delete)$/i.test(c.label)))),
  };
  cache.set(routeKey, s);
  return s;
}

const SKIP_COLS = new Set(["uid", "createdAt", "updatedAt"]);

/** A list screen for one whole entity: its own columns, foreign keys shown by name. Used by tabbed master screens. */
export function entityScreen(routeKey: string, entity: string): Screen | null {
  const route = ROUTES.find((x) => x.key === routeKey);
  const table = tableFor(entity);
  if (!route || !table) return null;
  const cols: ScreenCol[] = [];
  for (const c of table.columns) {
    if (SKIP_COLS.has(c.field) || cols.length >= 14) continue;
    if (c.sql === "jsonb") continue;
    const rel = c.fk ? c.field.replace(/Uid$/, "") : null;
    const res = rel && table.relations[rel] ? resolvePath(table, rel) : resolvePath(table, c.field);
    if (!res) continue;
    cols.push({ key: `c${cols.length}`, label: c.field.replace(/Uid$/, "").replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (x) => x.toUpperCase()), path: c.field, expr: res.expr, sql: res.sql, joins: res.joins });
  }
  const textCol = cols.find((c) => c.sql === "text");
  return {
    route, comp: null, table, cols, skipped: 0, filters: [], dateCol: null, buttons: [], tabs: [], editable: true,
    where: null, dateExpr: null, order: textCol ? textCol.expr : null, statusExpr: null,
  };
}
