/**
 * fp_beat (routes) from the customer-wise route mapping, and each customer's beat_uid.
 * The export reuses a route code for several routes, so a route is its code and name together.
 */
import { uid } from "../lib/ids";
import { mode, str } from "../lib/parse";
import { lookup, patch, upsert } from "../lib/sql";
import type { Rec, Row, Step } from "../types";

export const loadRoutes: Step = async (ctx) => {
  const routes = ctx.reports.routes;
  if (!routes.length) return;
  const firmByCode = await lookup(ctx, `select firm_code k, uid v from fp_firm`);

  const byRoute = new Map<string, { code: string; name: string; rows: Rec[] }>();
  for (const r of routes) {
    const name = str(r["Route Name"]), code = str(r["Route Code"]);
    if (!name && !code) continue;
    const key = `${code ?? ""}|${name ?? ""}`;
    const g = byRoute.get(key) ?? { code: code ?? "", name: name ?? "", rows: [] };
    g.rows.push(r);
    byRoute.set(key, g);
  }

  const beats: Row[] = [];
  const links: Row[] = [];
  for (const [key, g] of byRoute) {
    const beat = uid(`beat:${key}`);
    beats.push({
      uid: beat, beat_name: g.name || `Route ${g.code}`, beat_code: g.code || g.name, status: 1,
      state: mode(g.rows.map((r) => str(r["State"])?.toUpperCase()).filter(Boolean) as string[]),
      city: mode(g.rows.map((r) => str(r["City"])).filter(Boolean) as string[]),
    });
    for (const r of g.rows) {
      const firm = firmByCode.get(str(r["Customer Code"]) ?? "");
      if (firm) links.push({ uid: firm, beat_uid: beat });
    }
  }
  ctx.summary.push(`routes ${await upsert(ctx, "fp_beat", beats)}`);
  await patch(ctx, "fp_firm", links, ["beat_uid"]);
  ctx.summary.push(`customers mapped to a route ${links.length}`);
};
