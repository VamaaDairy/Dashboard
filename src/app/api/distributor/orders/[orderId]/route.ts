import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { distFromRequest, MAX_LINE_QTY } from "@/lib/distributor";
import { editOrderFromApp } from "@/lib/orders/direct";

export const dynamic = "force-dynamic";

/**
 * The buyer changes their own pending order before the cutoff. Body: { lines: [{ sku, qty }] } - the whole new
 * order; a product left out (or qty 0) is removed. Prices are worked out here again.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const login = await distFromRequest(req);
  if (!login) return fail(401, "Please sign in again.");
  if (tooMany(req, "dist-order-edit", 30)) return fail(429, "Too many changes. Please wait a minute.");
  const id = Number((await params).orderId);
  if (!Number.isInteger(id) || id < 1) return fail(404, "Order not found.");
  const b = (await readJson(req, 20_000)) as { lines?: unknown } | null;
  if (!b || !Array.isArray(b.lines) || b.lines.length > 200) return fail(400, "Invalid order.");
  const lines = new Map<string, number>();
  for (const l of b.lines) {
    const sku = String((l as { sku?: unknown })?.sku ?? "");
    const qty = Number((l as { qty?: unknown })?.qty);
    if (!sku || !Number.isInteger(qty) || qty < 0 || qty > MAX_LINE_QTY) return fail(400, "Check the quantities.");
    lines.set(sku, (lines.get(sku) ?? 0) + qty);
  }
  const r = await editOrderFromApp(login, id, lines);
  return r.ok ? NextResponse.json({ ok: true }) : fail(400, r.error);
}
