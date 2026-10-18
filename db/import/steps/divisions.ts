/** fp_division: names used by customers or routes. Existing divisions are left as they are. */
import { list } from "../lib/parse";
import type { Step } from "../types";

export const loadDivisions: Step = async (ctx) => {
  const names = new Set<string>();
  for (const r of [...ctx.reports.customers, ...ctx.reports.routes]) for (const d of list(r["Division"]) ?? []) names.add(d.toUpperCase());
  if (!names.size) return;
  for (const n of names) {
    await ctx.db.query(`insert into fp_division (name, active) values ($1, 1) on conflict (name) do nothing`, [n]);
  }
  ctx.summary.push(`divisions ${names.size}`);
};
