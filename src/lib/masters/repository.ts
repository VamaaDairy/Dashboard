import "server-only";
import { query } from "@/lib/db";
import { EXPORT_LIMIT, FILTER_OPTION_LIMIT, PAGE_SIZE } from "./constants";
import type { ListRequest, Listing, MasterDef } from "./types";

function where(def: MasterDef, req: ListRequest): { sql: string; args: unknown[] } {
  const conds: string[] = [];
  const args: unknown[] = [];
  if (req.q) {
    args.push(`%${req.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    conds.push(`(${def.search.map((e) => `${e}::text ilike $${args.length}`).join(" or ")})`);
  }
  for (const f of def.filters ?? []) {
    const v = req.filters[f.key];
    if (v === undefined) continue;
    args.push(v);
    conds.push(`${f.expr}::text = $${args.length}`);
  }
  return { sql: conds.length ? `where ${conds.join(" and ")}` : "", args };
}

const select = (def: MasterDef) => def.cols.map((c) => `${c.expr} as "${c.key}"`).join(", ");

/** The list's columns plus, for editable screens, the row id and on / off flag the row buttons need. */
const selectWithIds = (def: MasterDef) => {
  const e = def.entity;
  if (!e) return select(def);
  return `${select(def)}, ${e.idExpr}::text as "_id"${e.onExpr ? `, (${e.onExpr}) as "_on"` : ""}`;
};

export async function listMaster(def: MasterDef, req: ListRequest): Promise<Listing> {
  const w = where(def, req);
  const group = def.groupBy ? `group by ${def.groupBy}` : "";
  const countSql = def.groupBy
    ? `select count(*)::int as n from (select 1 from ${def.from} ${w.sql} ${group}) t`
    : `select count(*)::int as n from ${def.from} ${w.sql}`;

  const [{ n: total }] = await query<{ n: number }>(countSql, w.args);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(req.page, pages);

  const rowsP = query(
    `select ${selectWithIds(def)} from ${def.from} ${w.sql} ${group} order by ${def.order} limit ${PAGE_SIZE} offset ${(page - 1) * PAGE_SIZE}`,
    w.args,
  );
  const statsP = def.stats?.length
    ? query<Record<string, number>>(
        `select ${def.stats.map((s, i) => `(count(*) filter (where ${s.where}))::int as s${i}`).join(", ")} from ${def.from}`,
      )
    : Promise.resolve([] as Array<Record<string, number>>);
  const optionsP = Promise.all(
    (def.filters ?? []).map(async (f) => {
      const rows = await query<{ v: string }>(
        `select distinct ${f.expr}::text as v from ${def.from} where ${f.expr} is not null order by 1 limit ${FILTER_OPTION_LIMIT}`,
      );
      return [f.key, rows.map((r) => r.v)] as const;
    }),
  );
  const [rows, [statRow], options] = await Promise.all([rowsP, statsP, optionsP]);
  return {
    rows,
    total,
    pages,
    stats: (def.stats ?? []).map((s, i) => ({ label: s.label, value: statRow?.[`s${i}`] ?? 0 })),
    options: Object.fromEntries(options),
  };
}

/** Every row that matches (capped at EXPORT_LIMIT), for the CSV download. */
export async function exportMaster(def: MasterDef, req: ListRequest) {
  const w = where(def, req);
  const group = def.groupBy ? `group by ${def.groupBy}` : "";
  return query(
    `select ${select(def)} from ${def.from} ${w.sql} ${group} order by ${def.order} limit ${EXPORT_LIMIT}`,
    w.args,
  );
}
