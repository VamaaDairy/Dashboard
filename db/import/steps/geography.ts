/** fp_state and fp_city. States come from every report that names one; cities from CITY_MASTER. */
import { STATES } from "../constants";
import { uid } from "../lib/ids";
import { flag, mode, nowIso, stamp, str } from "../lib/parse";
import { upsert } from "../lib/sql";
import type { Row, Step } from "../types";

export const loadGeography: Step = async (ctx) => {
  const { cities, customers, empActive, empGone } = ctx.reports;
  if (!cities.length && !customers.length && !empActive.length) return;

  // a state's region is what its customers say; the built-in list only fills the gaps
  const regionVotes = new Map<string, string[]>();
  for (const c of customers) {
    const s = str(c["State"])?.toUpperCase(), r = str(c["Customer Region"])?.toUpperCase();
    if (s && r) regionVotes.set(s, [...(regionVotes.get(s) ?? []), r]);
  }

  const names = new Set<string>();
  for (const r of cities) { const s = str(r["State"])?.toUpperCase(); if (s) names.add(s); }
  for (const r of [...customers, ...empActive, ...empGone]) { const s = str(r["State"])?.toUpperCase(); if (s) names.add(s); }

  const stateRows: Row[] = [...names].map((s) => {
    const known = STATES[s];
    if (!known) ctx.warn.push(`state "${s}" is not in the built-in list - saved with a placeholder code`);
    return {
      state: s, code: known?.[0] ?? s.slice(0, 2), gstin_code: known?.[1] ?? "00",
      region: mode(regionVotes.get(s) ?? []) ?? known?.[2] ?? "EAST", active: 1, country_name: "India",
    };
  });
  ctx.summary.push(`states   ${await upsert(ctx, "fp_state", stateRows, ["state"])}`);

  const cityRows = cities.flatMap((r): Row[] => {
    const state = str(r["State"])?.toUpperCase(), name = str(r["City Name"]);
    if (!state || !name) return [];
    return [{
      uid: uid(`city:${state}|${name.toUpperCase()}`), city_name: name, city_state: state,
      status: flag(r["Status"]), created_at: stamp(r["Created At"]) ?? nowIso(), updated_at: stamp(r["Updated At"]) ?? nowIso(),
    }];
  });
  if (cityRows.length) ctx.summary.push(`cities   ${await upsert(ctx, "fp_city", cityRows)}`);
};
