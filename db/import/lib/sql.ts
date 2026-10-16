import { ADMIN_EMAIL, CHUNK, COMPANY_CHANNEL } from "../constants";
import type { Ctx, Row } from "../types";

/** Insert-or-update `input` into `table` keyed by `conflict`, in chunks, via jsonb_populate_recordset. */
export async function upsert(ctx: Ctx, table: string, input: Row[], conflict: string[] = ["uid"]): Promise<number> {
  // one statement can't touch the same row twice: a repeated key keeps its last row
  const seen = new Map<string, Row>();
  for (const r of input) seen.set(conflict.map((c) => String(r[c])).join("\u0000"), r);
  const rows = [...seen.values()];
  if (rows.length < input.length) ctx.warn.push(`${table}: ${input.length - rows.length} repeated row(s) in the export were merged`);
  if (!rows.length) return 0;

  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const norm = rows.map((r) => Object.fromEntries(keys.map((k) => [k, r[k] ?? null])));
  const cols = keys.map((k) => `"${k}"`).join(", ");
  const set = keys.filter((k) => !conflict.includes(k) && k !== "created_at").map((k) => `"${k}" = excluded."${k}"`);
  if (!keys.includes("updated_at")) set.push(`"updated_at" = now()`);
  const sql =
    `insert into ${table} (${cols}) select ${cols} from jsonb_populate_recordset(null::${table}, $1::jsonb) ` +
    `on conflict (${conflict.map((c) => `"${c}"`).join(", ")}) do update set ${set.join(", ")}`;
  try {
    for (let i = 0; i < norm.length; i += CHUNK) await ctx.db.query(sql, [JSON.stringify(norm.slice(i, i + CHUNK))]);
  } catch (e) {
    throw new Error(`${table}: ${e instanceof Error ? e.message : e}`);
  }
  return rows.length;
}

/** Set uuid columns `cols` on existing rows of `table`, matched by uid. */
export async function patch(ctx: Ctx, table: string, rows: Row[], cols: string[]) {
  const set = cols.map((c) => `"${c}" = x."${c}"`).join(", ");
  const defs = ["uid uuid", ...cols.map((c) => `"${c}" uuid`)].join(", ");
  for (let i = 0; i < rows.length; i += CHUNK) {
    await ctx.db.query(
      `update ${table} t set ${set} from jsonb_to_recordset($1::jsonb) as x(${defs}) where t.uid = x.uid`,
      [JSON.stringify(rows.slice(i, i + CHUNK))],
    );
  }
}

/** A `select <key> k, <uid> v ...` as a Map. Later rows win, so order the query. */
export async function lookup(ctx: Ctx, sql: string): Promise<Map<string, string>> {
  const { rows } = await ctx.db.query<{ k: string; v: string }>(sql);
  return new Map(rows.filter((r) => r.k != null).map((r) => [r.k, r.v]));
}

/** The company's own customer record (channel CMP): employees belong to it. */
export async function companyFirm(ctx: Ctx): Promise<string | undefined> {
  const { rows } = await ctx.db.query<{ uid: string }>(
    `select f.uid from fp_firm f join fp_channel c on c.uid = f.channel_uid where c.channel_code = $1 order by f.created_at limit 1`,
    [COMPANY_CHANNEL],
  );
  return rows[0]?.uid;
}

/** The employee that images and slabs are filed under, since the export doesn't say who made them. */
export async function adminStaff(ctx: Ctx): Promise<string | undefined> {
  const byEmail = await ctx.db.query<{ uid: string }>(`select uid from fp_staff where lower(email) = $1 limit 1`, [ADMIN_EMAIL]);
  if (byEmail.rows[0]) return byEmail.rows[0].uid;
  const any = await ctx.db.query<{ uid: string }>(`select uid from fp_staff order by active desc, created_at limit 1`);
  return any.rows[0]?.uid;
}
