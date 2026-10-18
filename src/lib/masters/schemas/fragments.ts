/** SQL snippets several master schemas share. */
import { STATUS_ACTIVE, STATUS_INACTIVE } from "../constants";

/** "First Last" of the staff row aliased `a`, or null when both are empty. */
export const person = (a: string) => `nullif(trim(${a}.first_name || ' ' || coalesce(${a}.last_name, '')), '')`;

/** 'Active' / 'Inactive' from an integer `active` column on alias `a`. */
export const active = (a: string) => `case when ${a}.active = 1 then '${STATUS_ACTIVE}' else '${STATUS_INACTIVE}' end`;

/** Cities carry `status` rather than `active`. */
export const cityStatus = `case when c.status = 1 then '${STATUS_ACTIVE}' else '${STATUS_INACTIVE}' end`;
