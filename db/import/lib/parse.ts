import { SOURCE_UTC_OFFSET } from "../constants";

export const str = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = (v instanceof Date ? v.toISOString() : String(v)).trim();
  return s === "" ? null : s;
};

export const num = (v: unknown): number | null => {
  const s = str(v);
  if (s === null) return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

export const flag = (v: unknown): 0 | 1 => (/^(yes|y|true|1|active)$/i.test(str(v) ?? "") ? 1 : 0);

/** "A, B" style lists (also "CRT:0.1, PCS:1"). Null when empty. */
export const list = (v: unknown): string[] | null => {
  const s = str(v);
  if (!s) return null;
  const out = s.split(",").map((x) => x.trim().replace(/^"+|"+$/g, "")).filter(Boolean);
  return out.length ? out : null;
};

/** Codes such as " 1,012" (Excel's thousands separator crept in) become "1012". */
export const code = (v: unknown): string | null => {
  const s = str(v);
  return s ? s.replace(/[\s,]/g, "") : null;
};

/** Upper-case, non-alphanumerics collapsed to "_": a stable code from a name. */
export const slug = (name: string) => name.toUpperCase().replace(/[^A-Z0-9]+/g, "_");

/** Distinct, trimmed, non-empty codes from "A, B, A". */
export const codes = (v: unknown): string[] => [...new Set((str(v) ?? "").split(",").map((x) => x.trim()).filter(Boolean))];

/** The most frequent value, or null for an empty list. */
export const mode = <T>(xs: T[]): T | null => {
  const counts = new Map<T, number>();
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1);
  let best: T | null = null, n = 0;
  for (const [k, v] of counts) if (v > n) { best = k; n = v; }
  return best;
};

// ---- dates

/** YYYY-MM-DD from a Date, "dd-mm-yyyy" or "yyyy-mm-dd ..." */
export function dateOnly(v: unknown): string | null {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = str(v);
  if (!s) return null;
  let m = /^(\d{2})-(\d{2})-(\d{4})/.exec(s);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** HH:MM:SS from "04:39 PM", "18:11:22" ... */
function timeOf(v: unknown): string {
  const m = /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i.exec(str(v) ?? "");
  if (!m) return "00:00:00";
  let h = Number(m[1]);
  const ap = m[4]?.toUpperCase();
  if (ap === "PM" && h < 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${m[2]}:${m[3] ?? "00"}`;
}

/** ISO timestamp (export time zone) from a date and an optional separate time column. */
export function stamp(date: unknown, time?: unknown): string | null {
  const s = typeof date === "string" ? date : null;
  const d = dateOnly(date);
  if (!d) return null;
  // "19-05-2026 11:56:10 AM" / "2026-06-18 18:11:22" carry their own time
  const own = s && /\d{1,2}:\d{2}/.test(s) ? timeOf(s.replace(/^\S+\s+/, "")) : null;
  return `${d}T${own ?? (time === undefined ? "00:00:00" : timeOf(time))}${SOURCE_UTC_OFFSET}`;
}

export const nowIso = () => new Date().toISOString();
