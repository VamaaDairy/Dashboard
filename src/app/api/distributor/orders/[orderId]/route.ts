import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { distFromRequest, MAX_LINE_QTY } from "@/lib/distributor";
import { editOrderFromApp } from "@/lib/orders/direct";

export const dynamic = "force-dynamic";

/**
 * The buyer changes a pending order of its own before the cutoff - one it placed or one its sales officer booked for it:
 * products added, quantities up or down. Body: { lines: [{ sku, qty, packs? }] } - the whole new order; a product left
 * out (or qty 0) is removed. Prices are worked out here again; the change goes in the order's history.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const login = await distFromRequest(req);
  if (!login) return fail(401, "Please sign in again.");
  if (tooMany(req, "dist-order-edit", 30)) return fail(429, "Too many changes. Please wait a minute.");
  const id = Number((await params).orderId);
  if (!Number.isInteger(id) || id < 1) return fail(404, "Order not found.");
  const b = (await readJson(req, 20_000)) as { lines?: unknown; paidOnly?: unknown } | null;
  if (!b || !Array.isArray(b.lines) || b.lines.length > 200) return fail(400, "Invalid order.");
  const lines = new Map<string, number>();
  const packs = new Map<string, number>();
  for (const l of b.lines) {
    const x = l as { sku?: unknown; qty?: unknown; packs?: unknown };
    const sku = String(x?.sku ?? "");
    const qty = Number(x?.qty);
    if (!sku || !Number.isInteger(qty) || qty < 0 || qty > MAX_LINE_QTY) return fail(400, "Check the quantities.");
    lines.set(sku, (lines.get(sku) ?? 0) + qty);
    if (x?.packs !== undefined && x?.packs !== null) {
      const p = Number(x.packs);
      if (!Number.isInteger(p) || p < 0 || p > qty) return fail(400, "Check the quantities.");
      packs.set(sku, (packs.get(sku) ?? 0) + p);
    }
  }
  // newer apps send only what is paid for (paidOnly), older ones the free items too
  const r = await editOrderFromApp(login, id, lines, packs, b.paidOnly === true);
  return r.ok ? NextResponse.json({ ok: true }) : fail(400, r.error);
}
