/** Pure helpers shared by the storefront (browser) and the order code (server). */

export const MAX_LINE_QTY = 20;
export const MAX_LINES = 30;

export interface DeliveryRule {
  fee: number;
  /** free delivery from this subtotal up; 0 = never free */
  freeAbove: number;
}

export function deliveryFor(subtotal: number, rule: DeliveryRule): number {
  if (subtotal <= 0) return 0;
  if (rule.freeAbove > 0 && subtotal >= rule.freeAbove) return 0;
  return rule.fee;
}

export const rupees = (n: number) =>
  `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: Number.isInteger(Number(n)) ? 0 : 2, maximumFractionDigits: 2 })}`;

/** "FGB2C_94 GAIA MAXX UHT MILK 120 ML" -> "Gaia Maxx UHT Milk 120 ml": internal codes dropped, shouting turned down. */
export function displayName(raw: string): string {
  const s = raw.replace(/^FGB2C_\d+\s+/i, "").trim();
  if (s !== s.toUpperCase()) return s;
  return s
    .toLowerCase()
    .replace(/\b([a-z])/g, (c) => c.toUpperCase())
    .replace(/\b(uht|pc|pcs)\b/gi, (w) => (w.toLowerCase() === "uht" ? "UHT" : w.toLowerCase()))
    .replace(/\b(ml|g|gm|gms|kg|ltr|l)\b/gi, (w) => w.toLowerCase());
}

export const STATUS_LABEL: Record<string, string> = {
  placed: "Order placed",
  confirmed: "Confirmed",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};
