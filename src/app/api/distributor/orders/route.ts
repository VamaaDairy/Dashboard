import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { distFromRequest, listDistOrders, MAX_LINE_QTY, placeDistOrder } from "@/lib/distributor";

export const dynamic = "force-dynamic";

/** Orders this login placed (a distributor: its own; a salesman: the ones he booked). */
export async function GET(req: NextRequest) {
  const login = await distFromRequest(req);
  if (!login) return fail(401, "Please sign in again.");
  return NextResponse.json({ orders: await listDistOrders(login) });
}

/** Place a primary order. Body: { firmUid?, notes?, lines: [{ sku, qty }] } - prices are always worked out here. */
export async function POST(req: NextRequest) {
  const login = await distFromRequest(req);
  if (!login) return fail(401, "Please sign in again.");
  if (tooMany(req, "dist-order", 20)) return fail(429, "Too many orders. Please wait a minute.");
  const b = (await readJson(req, 20_000)) as { firmUid?: unknown; notes?: unknown; lines?: unknown } | null;
  if (!b || !Array.isArray(b.lines)) return fail(400, "Invalid order.");
  const lines = b.lines.map((l) => ({ sku: String((l as { sku?: unknown })?.sku ?? ""), qty: Number((l as { qty?: unknown })?.qty) }));
  if (lines.some((l) => !l.sku || !Number.isInteger(l.qty) || l.qty < 1 || l.qty > MAX_LINE_QTY)) return fail(400, "Check the quantities.");
  const r = await placeDistOrder(login, {
    firmUid: typeof b.firmUid === "string" ? b.firmUid : undefined,
    notes: typeof b.notes === "string" ? b.notes : null,
    lines,
  });
  return r.ok ? NextResponse.json({ orderId: r.orderId, total: r.total }, { status: 201 }) : fail(400, r.error);
}
