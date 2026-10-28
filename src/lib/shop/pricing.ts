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

/**
 * The app's categories, in the order it shows them, and which Product Master categories go into each.
 * Since migration 065 the Product Master uses these categories itself (the old split ones are now
 * sub-categories); the extra names only catch an old category that comes back. Anything not listed
 * here keeps its own name and comes after these.
 */
export const SHOP_CATEGORIES: Array<{ name: string; from: string[] }> = [
  { name: "Milk", from: ["milk"] },
  { name: "Paneer", from: ["paneer", "low fat paneer"] },
  { name: "Ghee", from: ["ghee"] },
  { name: "Desserts", from: ["desserts", "peda", "shahi rabdi", "rabdi", "shrikhand", "shrikhand 6 pc", "khowa", "sweets"] },
  { name: "Beverages", from: ["lassi", "masala chaas", "chaas", "beverages"] },
  { name: "UHT Milk", from: ["uht milk"] },
  { name: "Dahi", from: ["plain dahi", "kadhi dahi", "dahi"] },
];

const CATEGORY_OF = new Map(SHOP_CATEGORIES.flatMap((c) => c.from.map((f) => [f, c.name] as const)));

/** The app category a Product Master category belongs to. */
export const shopCategory = (category: string | null | undefined) => {
  const c = (category ?? "").trim().replace(/\s+/g, " ");
  return CATEGORY_OF.get(c.toLowerCase()) ?? (c || "Other");
};

/** Where a category comes in the app: the grouped ones first, in their order, then the rest by name. */
export const categoryRank = (name: string) => {
  const i = SHOP_CATEGORIES.findIndex((c) => c.name === name);
  return i < 0 ? SHOP_CATEGORIES.length : i;
};
