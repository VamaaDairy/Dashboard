import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { distFromRequest, listDistOrders, MAX_LINE_QTY, placeDistOrder } from "@/lib/distributor";
import { appOrderExtras } from "@/lib/orders/direct";
import { trackingOf } from "@/lib/dispatch";

export const dynamic = "force-dynamic";

/**
 * Orders this login placed (a distributor: its own; a salesman: the ones he booked). Each carries deliveryDate,
 * editableUntil (ISO time, or null when the buyer can no longer change it) and history (placed / edited by Gaia /
 * confirmed ..., with what changed) and tracking: { stage: placed | confirmed | dispatched | delivered | not_delivered |
 * cancelled, trip: { route, vehicleNo, transporter, truck (live position while on the way), stopsBefore, stop } | null }.
 */
export async function GET(req: NextRequest) {
  const login = await distFromRequest(req);
  if (!login) return fail(401, "Please sign in again.");
  const orders = await listDistOrders(login);
  const [extras, tracking] = await Promise.all([appOrderExtras(orders.map((o) => o.uid)), trackingOf(orders.map((o) => o.uid))]);
  return NextResponse.json({
    orders: orders.map(({ uid, ...o }) => ({
      ...o,
      ...(extras.get(uid) ?? { deliveryDate: null, editableUntil: null, history: [] }),
      tracking: tracking.get(uid) ?? { stage: "placed", step: "placed", trip: null },
    })),
  });
}

/**
 * Place a primary order. Body: { firmUid?, notes?, lines: [{ sku, qty, packs? }], demandIds? } - qty is the total in pieces;
 * packs (optional) is how many of them were ordered as whole crates / boxes; demandIds (optional) the retailer
 * requirements this order covers, marked as ordered on it. Prices are always worked out here. Retailers can't order.
 */
export async function POST(req: NextRequest) {
  const login = await distFromRequest(req);
  if (!login) return fail(401, "Please sign in again.");
  if (tooMany(req, "dist-order", 20)) return fail(429, "Too many orders. Please wait a minute.");
  const b = (await readJson(req, 20_000)) as { firmUid?: unknown; notes?: unknown; lines?: unknown; demandIds?: unknown } | null;
  if (!b || !Array.isArray(b.lines)) return fail(400, "Invalid order.");
  const lines = b.lines.map((l) => {
    const x = l as { sku?: unknown; qty?: unknown; packs?: unknown };
    return { sku: String(x?.sku ?? ""), qty: Number(x?.qty), packs: x?.packs === undefined || x?.packs === null ? null : Number(x.packs) };
  });
  if (lines.some((l) => !l.sku || !Number.isInteger(l.qty) || l.qty < 1 || l.qty > MAX_LINE_QTY)) return fail(400, "Check the quantities.");
  if (lines.some((l) => l.packs !== null && (!Number.isInteger(l.packs) || l.packs < 0 || l.packs > l.qty))) return fail(400, "Check the quantities.");
  const r = await placeDistOrder(login, {
    firmUid: typeof b.firmUid === "string" ? b.firmUid : undefined,
    notes: typeof b.notes === "string" ? b.notes : null,
    lines,
    demandIds: Array.isArray(b.demandIds) ? b.demandIds.map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 500) : [],
  });
  return r.ok ? NextResponse.json({ orderId: r.orderId, total: r.total }, { status: 201 }) : fail(400, r.error);
}
