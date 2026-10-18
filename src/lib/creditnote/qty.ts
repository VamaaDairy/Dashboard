/**
 * Credit-note quantities, as cases + loose pieces.
 *
 * Every quantity is stored as total pieces. An item whose case holds more than
 * one piece (a CRT of 24) reads "2 CRT 5 Pcs"; one counted singly (KG, PCS) just
 * reads "12 KG".
 */
export interface QtyItem {
  return_unit: string;
  pcs_per_case: number;
  claim_qty: number | null;
  approved_qty: number | null;
}

const num = (n: number) => String(+n.toFixed(3));

export function splitQty(total: number, ppc: number): { cases: number; loose: number } {
  if (ppc <= 1) return { cases: total, loose: 0 };
  const cases = Math.floor(total / ppc + 1e-9);
  return { cases, loose: +(total - cases * ppc).toFixed(3) };
}

/** Cases + loose typed into two boxes -> total pieces; null when both are empty. */
export function joinQty(cases: string, loose: string, ppc: number): number | null {
  const c = cases.replace(/,/g, "").trim();
  const l = loose.replace(/,/g, "").trim();
  if (c === "" && l === "") return null;
  const cn = c === "" ? 0 : Number(c);
  const ln = l === "" ? 0 : Number(l);
  if (!Number.isFinite(cn) || !Number.isFinite(ln) || cn < 0 || ln < 0) return NaN;
  return +(cn * (ppc > 1 ? ppc : 1) + ln).toFixed(3);
}

/** "2 CRT 5 Pcs", "3 CRT", "12 Pcs", "12 KG". */
export function qtyText(total: number | null, unit: string, ppc: number): string {
  if (total === null) return "";
  if (ppc <= 1) return `${num(total)} ${unit}`;
  const { cases, loose } = splitQty(total, ppc);
  return [cases > 0 ? `${num(cases)} ${unit}` : "", loose > 0 ? `${num(loose)} Pcs` : ""].filter(Boolean).join(" ") || `0 ${unit}`;
}

/** Totals for a note. Cased items add up in pieces; singly-counted items add up per unit. */
export function totals(items: QtyItem[], field: "claim_qty" | "approved_qty"): string {
  const by = new Map<string, number>();
  for (const i of items) {
    const v = i[field];
    if (v === null) continue;
    const key = i.pcs_per_case > 1 ? "Pcs" : i.return_unit;
    by.set(key, (by.get(key) ?? 0) + Number(v));
  }
  return [...by].map(([u, q]) => `${num(q)} ${u}`).join(" + ");
}

/** The status shown for a note: Pending, Approved or Rejected - nothing in between. */
export function statusLabel(n: { status: string }): string {
  return n.status === "approved" ? "Approved" : n.status === "rejected" ? "Rejected" : "Pending";
}
