import type { ListRequest, MasterDef, SearchParams } from "./types";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Reads q / page / f_<filter> from a URL. Filters the screen doesn't define are ignored. */
export function readRequest(def: MasterDef, params: SearchParams): ListRequest {
  const filters: Record<string, string> = {};
  for (const f of def.filters ?? []) {
    const v = first(params[`f_${f.key}`]).trim();
    if (v) filters[f.key] = v;
  }
  const page = Math.max(1, Math.floor(Number(first(params.page))) || 1);
  return { q: first(params.q).trim(), page, filters };
}
