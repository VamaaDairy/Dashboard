/** "500 ml" -> 500 + ml, "6 x 80 g" -> "6 x 80" + g, "1 Ltr" -> 1 + Ltr. Anything else stays whole as the quantity. */
export function qtyUnit(size: string | null | undefined): { qty: string | null; unit: string | null } {
  const s = (size ?? "").trim();
  if (!s) return { qty: null, unit: null };
  const m = /^(.*\d)\s*([A-Za-z]+)\.?$/.exec(s);
  return m ? { qty: m[1].trim(), unit: m[2] } : { qty: s, unit: null };
}
