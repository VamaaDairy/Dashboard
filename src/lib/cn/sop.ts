/**
 * The CN Management SOP as plain data: stages, lists, TAT and the approval matrix.
 * Pure (no database), so pages, actions and the dashboard all read the same rules.
 *
 * The approval limits and TAT days below are working defaults - change them here
 * and everything (checks, labels, overdue flags) follows.
 */
export type Stage =
  | "registered" | "logged" | "assigned" | "rca_done" | "recommended" | "approved" | "posted" | "closed" | "rejected";

export const STAGES: { key: Stage; label: string; who: string }[] = [
  { key: "registered", label: "Registered", who: "MIS" },
  { key: "logged", label: "Logged", who: "MIS" },
  { key: "assigned", label: "Investigation", who: "Department" },
  { key: "rca_done", label: "RCA & CAPA done", who: "Sales / CN owner" },
  { key: "recommended", label: "CN recommended", who: "Approver" },
  { key: "approved", label: "Approved", who: "Finance" },
  { key: "posted", label: "CN posted", who: "Closure" },
  { key: "closed", label: "Closed", who: "" },
];

export const stageLabel = (s: string) =>
  s === "rejected" ? "Rejected" : STAGES.find((x) => x.key === s)?.label ?? s;

export const OPEN_STAGES: Stage[] = ["registered", "logged", "assigned", "rca_done", "recommended", "approved", "posted"];

export const CUSTOMER_TYPES = ["Retailer", "Dealer", "Café / HoReCa", "Distributor", "Modern Trade / MFS", "Other"];

export const CATEGORIES = [
  "Product quality", "Damaged / leaking pack", "Short quantity", "Wrong item delivered",
  "Expired / short shelf life", "Late delivery", "Packaging defect", "Other",
];

/** Departments a complaint can be assigned to for investigation. */
export const DEPARTMENTS = ["Production", "Quality", "Packaging & Stores", "Logistics / Dispatch", "Sales", "Procurement", "Other"];

export const QTY_UNITS = ["Pcs", "Case", "Kg", "Ltr", "Box"];

/** Days each stage may take before it counts as overdue. `assigned` is set per complaint at assignment. */
export const TAT_DAYS: Record<string, number> = {
  registered: 1, logged: 1, assigned: 3, rca_done: 1, recommended: 2, approved: 2, posted: 7,
};
/** Days past the due date before it is escalated to management. */
export const ESCALATE_AFTER = 2;
/** Days after the CAPA target date by which its effectiveness must be reviewed. */
export const CAPA_REVIEW_DAYS = 30;
/** Same product + category again within this many days of an earlier complaint is a repeat. */
export const REPEAT_WINDOW_DAYS = 90;

/** Approval matrix: who must approve a CN of a given value, lowest authority first. */
export const APPROVAL_MATRIX: { level: string; upto: number }[] = [
  { level: "Sales Manager", upto: 5_000 },
  { level: "Head of Sales", upto: 25_000 },
  { level: "Business Head", upto: 100_000 },
  { level: "Director", upto: Infinity },
];

export const levelNames = APPROVAL_MATRIX.map((m) => m.level);

/** The lowest authority that can approve this value. */
export function requiredLevel(value: number): string {
  return (APPROVAL_MATRIX.find((m) => value <= m.upto) ?? APPROVAL_MATRIX[APPROVAL_MATRIX.length - 1]).level;
}

/** True when `have` is the required level or higher in the matrix. */
export const levelCovers = (have: string, need: string) => levelNames.indexOf(have) >= levelNames.indexOf(need) && levelNames.indexOf(have) >= 0;

const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

export type TatState = "ok" | "due" | "overdue" | "escalated" | "done";
export interface Tat { state: TatState; due: string | null; late: number }

/** Where a complaint stands against its TAT for the stage it is in. */
export function tatOf(c: { stage: string; stage_on: string; tat_due: string | null }, today: string): Tat {
  if (c.stage === "closed" || c.stage === "rejected") return { state: "done", due: null, late: 0 };
  const days = TAT_DAYS[c.stage] ?? 1;
  let due: string;
  if (c.stage === "assigned" && c.tat_due) due = c.tat_due;
  else {
    const d = new Date(`${c.stage_on}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    due = d.toISOString().slice(0, 10);
  }
  const late = dayDiff(due, today);
  const state: TatState = late >= ESCALATE_AFTER ? "escalated" : late > 0 ? "overdue" : late === 0 ? "due" : "ok";
  return { state, due, late };
}

export const tatText = (t: Tat) =>
  t.state === "done" ? "—" : t.state === "escalated" ? `Escalated · ${t.late}d late` : t.state === "overdue" ? `Overdue · ${t.late}d` : t.state === "due" ? "Due today" : "On track";

export const rupees = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : "₹" + Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 });

/** YYYY-MM-DD as DD/MM/YYYY. */
export const dmy = (d: string | null) => (d ? d.split("-").reverse().join("/") : "—");
