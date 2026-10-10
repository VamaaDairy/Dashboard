import type { CreditNote } from "./data";

/** Everything a credit-note list or dashboard can be narrowed by. An empty string means "any". */
export interface NoteFilter {
  q: string;          // free text: challan no., customer, product, contact, vehicle, dispatch challan, remarks
  status: string;     // pending | approved | rejected
  customer: string;
  product: string;    // any item
  reason: string;     // any item
  team: string;
  checked: string;    // checked by
  approver: string;   // approved by
  from: string;       // challan date, inclusive
  to: string;
}

export const FILTER_KEYS = ["q", "status", "customer", "product", "reason", "team", "checked", "approver", "from", "to"] as const;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** The filter in a page's ?query. Dates are only kept when valid. */
export function readFilter(sp: Record<string, string | string[] | undefined>): NoteFilter {
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() : "");
  const f = Object.fromEntries(FILTER_KEYS.map((k) => [k, get(k)])) as unknown as NoteFilter;
  if (!["pending", "approved", "rejected"].includes(f.status)) f.status = "";
  if (!ISO.test(f.from)) f.from = "";
  if (!ISO.test(f.to)) f.to = "";
  return f;
}

export function applyFilter(notes: CreditNote[], f: NoteFilter): CreditNote[] {
  const q = f.q.toLowerCase();
  return notes.filter((n) => {
    if (f.status && n.status !== f.status) return false;
    if (f.customer && n.customer_name !== f.customer) return false;
    if (f.team && n.team_name !== f.team) return false;
    if (f.checked && n.checked_by !== f.checked) return false;
    if (f.approver && n.approved_by !== f.approver) return false;
    if (f.from && n.challan_date < f.from) return false;
    if (f.to && n.challan_date > f.to) return false;
    if (f.product && !n.items.some((i) => i.material_name === f.product)) return false;
    if (f.reason && !n.items.some((i) => (i.reason ?? "").trim() === f.reason)) return false;
    if (q) {
      const hay = [
        n.challan_no, n.customer_name, n.contact_no, n.address, n.vehicle_no, n.dispatch_challan_no, n.checked_by, n.team_name, n.approved_by,
        ...n.items.flatMap((i) => [i.material_name, i.reason, i.quality_remark]),
      ].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export interface FilterOptions {
  customers: string[]; products: string[]; reasons: string[]; teams: string[]; checkers: string[]; approvers: string[];
}

const uniq = (xs: (string | null | undefined)[]) =>
  [...new Set(xs.map((x) => (x ?? "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));

/** What each dropdown offers: every value that exists on any note. */
export function filterOptions(notes: CreditNote[]): FilterOptions {
  return {
    customers: uniq(notes.map((n) => n.customer_name)),
    products: uniq(notes.flatMap((n) => n.items.map((i) => i.material_name))),
    reasons: uniq(notes.flatMap((n) => n.items.map((i) => i.reason))),
    teams: uniq(notes.map((n) => n.team_name)),
    checkers: uniq(notes.map((n) => n.checked_by)),
    approvers: uniq(notes.map((n) => n.approved_by)),
  };
}
