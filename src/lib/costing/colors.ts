/**
 * One colour per kind of cost, used everywhere costs are drawn - stacks,
 * column headers, legends - so a cost is the same colour on every page.
 *
 * Validated as a categorical set on the light surface in this order (every
 * adjacent pair clears CVD dE 9+, normal-vision dE 19+): milk, ingredients,
 * packing, electricity, coal, labour, milk transport, delivery. Stack them in
 * this order. Coal and milk transport are close for deutan readers, so never
 * put those two next to each other - in a fuel-only stack go coal, delivery,
 * milk transport. Yellow, pink and teal are under 3:1 on white, so every chart
 * using them carries a legend and a table.
 */
export const COST = {
  milk:             { label: "Milk",              color: "#3548a8" },
  ingredients:      { label: "Ingredients",       color: "#2f9e44" },
  packing:          { label: "Packing",           color: "#e87ba4" },
  electricity:      { label: "Electricity",       color: "#eda100" },
  fuel_production:  { label: "Coal / plant fuel", color: "#e34948" },
  labour:           { label: "Labour",            color: "#4a3aa7" },
  fuel_procurement: { label: "Milk transport",    color: "#eb6834" },
  fuel_delivery:    { label: "Delivery",          color: "#1baf7a" },
} as const;

export type CostKey = keyof typeof COST;

/** The stacking order above. */
export const COST_ORDER: CostKey[] = [
  "milk", "ingredients", "packing", "electricity", "fuel_production", "labour", "fuel_procurement", "fuel_delivery",
];

/** Colour for an overhead head code; heads without their own colour share a neutral grey. */
export function headColor(code: string): string {
  return (COST as Record<string, { color: string }>)[code]?.color ?? "#898781";
}

/** Short label for an overhead head code. */
export function headLabel(code: string, fallback: string): string {
  return (COST as Record<string, { label: string }>)[code]?.label ?? fallback;
}

/** A colour at low opacity, for tinting a table column of that cost. */
export function tint(color: string, alpha = 0.08): string {
  const n = parseInt(color.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
