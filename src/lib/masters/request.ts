import { DISPLAY_TZ } from "./constants";
import type { ListRequest, MasterDef, SearchParams } from "./types";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Reads q / page / f_<filter> from a URL. Filters the screen doesn't define are ignored. */
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (s: string) => ISO.test(s) && !Number.isNaN(Date.parse(s));

/** Today in the plant's time zone, as YYYY-MM-DD. */
export const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: DISPLAY_TZ });
export const addDaysIso = (iso: string, n: number) => new Date(Date.parse(iso) + n * 86_400_000).toISOString().slice(0, 10);

export function readRequest(def: MasterDef, params: SearchParams): ListRequest {
  const filters: Record<string, string> = {};
  for (const f of def.filters ?? []) {
    const v = first(params[`f_${f.key}`]).trim();
    if (v) filters[f.key] = v;
  }
  const page = Math.max(1, Math.floor(Number(first(params.page))) || 1);
  const req: ListRequest = { q: first(params.q).trim(), page, filters };
  if (def.dateRange) {
    const to = first(params.to).trim();
    const from = first(params.from).trim();
    req.to = validDate(to) ? to : todayIso();
    req.from = validDate(from) ? from : addDaysIso(req.to, -(def.dateRange.days - 1));
    if (req.from > req.to) [req.from, req.to] = [req.to, req.from];
  }
  return req;
}
