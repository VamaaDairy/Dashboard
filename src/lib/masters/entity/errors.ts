import type { EntityDef } from "../types";
import type { FieldErrors } from "./validate";

/** A problem the user can fix: shown next to a field, or as the form's message. */
export class FormError extends Error {
  constructor(message: string, readonly field?: string) {
    super(message);
  }
}

export interface Failure {
  error: string;
  fieldErrors?: FieldErrors;
}

/** Turns a Postgres error into something a person can act on; unknown errors are rethrown. */
export function explain(e: unknown, entity: EntityDef, during: "save" | "delete"): Failure {
  if (e instanceof FormError) return { error: e.message, fieldErrors: e.field ? { [e.field]: e.message } : undefined };
  const err = e as { code?: string; detail?: string; column?: string };
  const label = (col: string) => entity.fields.find((f) => f.name === col)?.label ?? col;

  switch (err.code) {
    case "23505": {
      const cols = /Key \((.+?)\)=/.exec(err.detail ?? "")?.[1].split(",").map((c) => c.trim()) ?? [];
      const names = cols.map(label).join(" + ");
      const msg = names ? `A ${entity.noun} with this ${names} already exists` : `This ${entity.noun} already exists`;
      const field = cols.find((c) => entity.fields.some((f) => f.name === c));
      return { error: msg, fieldErrors: field ? { [field]: msg } : undefined };
    }
    case "23503":
      return {
        error:
          during === "delete"
            ? `This ${entity.noun} is still used by other records - deactivate it instead.`
            : "One of the chosen values no longer exists - reload and pick again.",
      };
    case "23502": {
      const msg = `${err.column ? label(err.column) : "A required value"} is required`;
      return { error: msg, fieldErrors: err.column ? { [err.column]: msg } : undefined };
    }
    case "22P02":
    case "22003":
    case "22007":
    case "22001":
      return { error: "One of the values is not valid or is too long." };
    default:
      throw e;
  }
}
