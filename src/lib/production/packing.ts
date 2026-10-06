/**
 * A day's packing material from a SKU's standing list: each line's quantity
 * per piece (or per full case) times what was packed, at the item's rate.
 */
export function standardMaterial(
  list: { packaging_id: string; name: string; unit: "kg" | "pcs"; qty: number; per: "pc" | "case"; rate: number | null }[],
  pcs: number,
  cases: number,
): { packaging_id: string; name: string; unit: "kg" | "pcs"; qty: number; price: number }[] {
  return list
    .map((l) => ({
      packaging_id: l.packaging_id, name: l.name, unit: l.unit,
      qty: Math.round(l.qty * (l.per === "case" ? cases : pcs) * 1000) / 1000,
      price: l.rate ?? 0,
    }))
    .filter((l) => l.qty > 0);
}
