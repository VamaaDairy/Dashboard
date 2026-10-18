/** The single material line for a SKU costed at a flat packing rate per piece. */
export const RATE_LINE_NAME = "Packing cost (rate per pc)";

/**
 * A day's packing material for a SKU with a packing rate per piece: one line,
 * pieces packed at that rate. Empty when nothing was packed.
 */
export function rateMaterial(rate: number, pcs: number) {
  return pcs > 0 ? [{ packaging_id: null, name: RATE_LINE_NAME, unit: "pcs" as const, qty: pcs, price: rate }] : [];
}

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

/** How a packing line's quantity is worked out; see db/035_packing_factors.sql. */
export type Basis = "qty" | "grams" | "per_kg" | "share";

export const BASIS_LABEL: Record<Basis, string> = {
  qty: "quantity",
  grams: "g per piece",
  per_kg: "pieces per kg",
  share: "pieces per item",
};

/** The quantity (kg or pieces, per piece or per case) a basis and its value come to. */
export function qtyFromBasis(basis: Basis, value: number): number {
  if (!(value > 0)) return 0;
  if (basis === "grams") return Math.round(value * 1000) / 1e6;       // g -> kg, to 6 places
  if (basis === "per_kg" || basis === "share") return Math.round(1e6 / value) / 1e6;
  return value;
}
