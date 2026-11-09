import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { customerFromRequest } from "@/lib/shop/customer";
import { priceCart } from "@/lib/shop/offers";
import { deliveryRule } from "@/lib/shop/orders";
import { MAX_LINE_QTY, MAX_LINES } from "@/lib/shop/pricing";

export const dynamic = "force-dynamic";

/**
 * The cart as the order will be priced: { lines: [{ sku, qty }], code? } -> items with their discounts, free
 * items, the offers used, hints ("add 1 more ..."), delivery and the total. Signing in is optional; with a
 * token (Authorization: Bearer) the customer's own limits and first-order offers are checked too.
 */
export async function POST(req: NextRequest) {
  if (tooMany(req, "quote", 60)) return fail(429, "Too many requests. Please wait a minute.");
  const body = (await readJson(req)) as { lines?: unknown; code?: unknown } | null;
  if (!body || !Array.isArray(body.lines)) return fail(400, "Send { lines: [{ sku, qty }] }.");
  const merged = new Map<string, number>();
  for (const l of body.lines.slice(0, MAX_LINES)) {
    const sku = typeof (l as { sku?: unknown })?.sku === "string" ? (l as { sku: string }).sku.slice(0, 60) : "";
    const qty = Number((l as { qty?: unknown })?.qty);
    if (sku && Number.isInteger(qty) && qty >= 1) merged.set(sku, Math.min(MAX_LINE_QTY, (merged.get(sku) ?? 0) + qty));
  }
  const customer = await customerFromRequest(req);
  const code = typeof body.code === "string" ? body.code : null;
  const q = await priceCart([...merged].map(([sku, qty]) => ({ sku, qty })), { customerId: customer?.id ?? null, phone: customer?.phone ?? null, code, rule: deliveryRule });
  return NextResponse.json({
    lines: q.lines.map((l) => ({ sku: l.sku, qty: l.qty, price: l.price, gross: l.gross, discount: l.discount, total: l.total, offer: l.offerTitle })),
    free: q.free.map((f) => ({ sku: f.sku, name: f.name, image: f.image, qty: f.qty, worth: f.worth, offer: f.offerTitle })),
    offers: q.applied.map((a) => ({ id: a.id, title: a.title, discount: a.discount, freeUnits: a.freeUnits })),
    subtotal: q.subtotal,
    discount: q.discount,
    cartOffer: q.cartOfferTitle,
    cartDiscount: q.cartDiscount,
    itemsTotal: q.itemsTotal,
    deliveryFee: q.deliveryFee,
    total: q.total,
    savings: q.savings,
    code: q.code,
    codeStatus: q.codeStatus,
    codeMessage: q.codeMessage,
    hints: q.hints,
    unavailable: q.unavailable,
  }, { headers: { "Cache-Control": "no-store" } });
}
