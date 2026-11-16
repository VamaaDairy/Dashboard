import "server-only";
import type { NextRequest } from "next/server";
import { MASTERS, MASTER_LIST } from "@/lib/masters/schemas";
import type { MasterDef } from "@/lib/masters/types";
import { apiCaller, apiError, can, forbidden, unauthorised, type ApiCaller } from "./access";

/** Every master the caller may open, with its columns and, for editable ones, the fields a create / update takes. */
export function describe(def: MasterDef, editable: boolean) {
  return {
    slug: def.slug,
    title: def.title,
    subtitle: def.subtitle,
    columns: def.cols.map((c) => ({ key: c.key, label: c.label })),
    filters: (def.filters ?? []).map((f) => ({ key: f.key, label: f.label, param: `f_${f.key}` })),
    dateRange: def.dateRange ? { days: def.dateRange.days, params: ["from", "to"] } : null,
    editable: editable && !!def.entity,
    fields: def.entity
      ? def.entity.fields
          .filter((f) => !f.virtual && f.type !== "photos")
          .map((f) => ({ name: f.name, label: f.label, type: f.type, required: !!f.required, options: f.options ?? null, lockOnEdit: !!f.lockOnEdit }))
      : null,
  };
}

export const mastersFor = (c: ApiCaller) => MASTER_LIST.filter((d) => can(c, `fp.${d.slug}`, "view"));

/** The caller and the master named in the URL, after checking they may [need] it; or the error response to send. */
export async function masterAccess(req: NextRequest, slug: string, need: "view" | "edit") {
  const caller = await apiCaller(req);
  if (!caller) return { error: unauthorised() } as const;
  const def = MASTERS[slug];
  if (!def) return { error: apiError(404, `No master called "${slug}". GET /api/masters lists them.`) } as const;
  if (!can(caller, `fp.${slug}`, need)) return { error: forbidden() } as const;
  if (need === "edit" && !def.entity) return { error: apiError(405, `${def.title} is read-only.`) } as const;
  return { caller, def } as const;
}

/**
 * A JSON object -> the FormData the masters' save code reads (the same as the Dashboard form posts):
 * true / false -> "1" / "0", null -> "" (empty), numbers -> text. Unknown keys are ignored by the save.
 */
export function asForm(body: Record<string, unknown>): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(body)) {
    if (v === undefined) continue;
    form.set(k, v === null ? "" : typeof v === "boolean" ? (v ? "1" : "0") : typeof v === "object" ? JSON.stringify(v) : String(v));
  }
  return form;
}
