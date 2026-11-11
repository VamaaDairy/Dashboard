import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { listDistOrders, MAX_LINE_QTY, placeDistOrder } from "@/lib/distributor";
import { ownsOpenVisit, sfFromRequest } from "@/lib/salesforce";

export const dynamic = "force-dynamic";

/** The orders this officer booked for their parties. */
export async function GET(req: NextRequest) {
  const login = await sfFromRequest(req);
  if (!login) return fail(401, "Please sign in again.");
  return NextResponse.json({ orders: await listDistOrders(login) });
}

/**
 * Book an order on behalf of one of the officer's parties (distributor, super stockist, MFS, institution, PT or
 * retailer), at that party's own prices. Body: { firmUid, visitId?, notes?, lines: [{ sku, qty }] }.
 * A visit is optional: when one is given it must be the officer's open visit, and the order is linked to it.
 */
export async function POST(req: NextRequest) {
  const login = await sfFromRequest(req);
  if (!login) return fail(401, "Please sign in again.");
  if (tooMany(req, "sf-order", 20)) return fail(429, "Too many orders. Please wait a minute.");
  const b = (await readJson(req, 20_000)) as { firmUid?: unknown; visitId?: unknown; notes?: unknown; lines?: unknown } | null;
  if (!b || !Array.isArray(b.lines) || typeof b.firmUid !== "string") return fail(400, "Invalid order.");
  const visitId = b.visitId == null ? null : Number.isInteger(b.visitId) ? (b.visitId as number) : NaN;
  if (visitId !== null && (Number.isNaN(visitId) || !(await ownsOpenVisit(login.staffUid, visitId)))) {
    return fail(400, "That store visit is no longer open. Check in again, or book the order without a visit.");
  }
  const lines = b.lines.map((l) => ({ sku: String((l as { sku?: unknown })?.sku ?? ""), qty: Number((l as { qty?: unknown })?.qty) }));
  if (lines.some((l) => !l.sku || !Number.isInteger(l.qty) || l.qty < 1 || l.qty > MAX_LINE_QTY)) return fail(400, "Check the quantities.");
  const r = await placeDistOrder(login, {
    firmUid: b.firmUid, visitId, notes: typeof b.notes === "string" ? b.notes : null, lines,
  });
  return r.ok ? NextResponse.json({ orderId: r.orderId, total: r.total }, { status: 201 }) : fail(400, r.error);
}
