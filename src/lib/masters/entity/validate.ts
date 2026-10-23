import type { EntityDef, Field } from "../types";

export type Values = Record<string, unknown>;
export type FieldErrors = Record<string, string>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** ids reach the database as text, so check their shape first rather than let Postgres reject them */
export const validId = (entity: EntityDef, id: string) => (entity.idCol === "uid" ? UUID.test(id) : /^\d{1,18}$/.test(id));

/** Fields that are saved: virtual ones are read by hooks, locked ones only when adding. */
export const editableFields = (entity: EntityDef, isNew: boolean) => entity.fields.filter((f) => isNew || !f.lockOnEdit);

export const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const PHOTO_MAX = 3 * 1024 * 1024;
export interface PhotoChanges { add: File[]; remove: string[] }

function photos(f: Field, form: FormData): { value: PhotoChanges; error?: string } {
  const add = form.getAll(f.name).filter((x): x is File => x instanceof File && x.size > 0);
  const remove = form.getAll(`${f.name}_remove`).map(String).filter((x) => UUID.test(x));
  const bad = add.find((x) => !PHOTO_TYPES.has(x.type) || x.size > PHOTO_MAX);
  return { value: { add, remove }, error: bad ? `${bad.name}: photos must be JPG, PNG or WebP, up to 3 MB each` : undefined };
}

function one(f: Field, raw: FormDataEntryValue | null): { value: unknown; error?: string } {
  if (f.type === "bool") return { value: raw === "on" || raw === "1" ? 1 : 0 };

  let text = typeof raw === "string" ? raw.trim() : "";
  if (f.upper) text = text.toUpperCase();
  if (!text) {
    if (f.required) return { value: null, error: `${f.label} is required` };
    return { value: f.whenEmpty ?? null };
  }

  switch (f.type) {
    case "number": {
      const n = Number(text.replace(/,/g, ""));
      if (!Number.isFinite(n)) return { value: null, error: `${f.label} must be a number` };
      if (f.min !== undefined && n < f.min) return { value: null, error: `${f.label} cannot be below ${f.min}` };
      if (f.max !== undefined && n > f.max) return { value: null, error: `${f.label} cannot be above ${f.max}` };
      return { value: n };
    }
    case "date":
      if (!ISO_DATE.test(text) || Number.isNaN(Date.parse(text))) return { value: null, error: `${f.label}: pick a valid date` };
      return { value: text };
    case "select":
      return f.options?.includes(text) ? { value: text } : { value: null, error: `${f.label}: pick one from the list` };
    default:
      return { value: text };
  }
}

/** Reads the form into typed values, collecting every problem rather than stopping at the first. */
export function readForm(entity: EntityDef, form: FormData, isNew: boolean): { values: Values; errors: FieldErrors } {
  const values: Values = {};
  const errors: FieldErrors = {};
  for (const f of editableFields(entity, isNew)) {
    const r = f.type === "photos" ? photos(f, form) : one(f, form.get(f.name));
    values[f.name] = r.value;
    if (r.error) errors[f.name] = r.error;
  }
  return { values, errors };
}
