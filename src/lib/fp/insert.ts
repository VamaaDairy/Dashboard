import type { PoolClient } from "pg";
import { MODEL } from "./model";

const SKIP = new Set(["createdAt", "updatedAt"]);

/** Inserts a row by entity / field names. Required columns left out get a neutral default; unknown names throw. */
export async function insertRow(db: Pick<PoolClient, "query">, entity: string, v: Record<string, unknown>): Promise<string> {
  const t = MODEL[entity];
  if (!t) throw new Error(`no entity ${entity}`);
  const cols: string[] = [], vals: unknown[] = [], ph: string[] = [];
  for (const k of Object.keys(v)) if (v[k] !== undefined && !t.columns.some((c) => c.field === k)) throw new Error(`${entity}.${k} does not exist`);
  for (const c of t.columns) {
    if (SKIP.has(c.field)) continue;
    let val = v[c.field];
    if (val === undefined) {
      if (c.field === "uid" || !c.required) continue;
      if (c.sql === "text") val = "NA";
      else if (c.sql === "integer" || c.sql === "bigint" || c.sql === "double precision") val = 0;
      else if (c.sql === "timestamptz") val = new Date();
      else if (c.sql === "boolean") val = false;
      else throw new Error(`${entity}.${c.field} is required`);
    }
    cols.push(`"${c.col}"`);
    vals.push(c.sql === "jsonb" && val !== null ? JSON.stringify(val) : val);
    ph.push(c.sql === "jsonb" ? `$${vals.length}::jsonb` : `$${vals.length}`);
  }
  const sql = cols.length
    ? `insert into "${t.table}" (${cols.join(",")}) values (${ph.join(",")}) returning "${t.pk}"::text as id`
    : `insert into "${t.table}" default values returning "${t.pk}"::text as id`;
  return (await db.query(sql, vals)).rows[0].id as string;
}
