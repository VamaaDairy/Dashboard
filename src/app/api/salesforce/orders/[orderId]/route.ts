import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { MAX_LINE_QTY } from "@/lib/distributor";
import { sfFromRequest } from "@/lib/salesforce";
import { editOrderFromApp } from "@/lib/orders/direct";

export const dynamic = "force-dynamic";

/**
 * The sales officer changes a pending order of one of their parties before the cutoff - one they booked or one the party
 * placed itself: products added, quantities up or down. Body: { lines: [{ sku, qty, packs? }] } - the whole new order; a
 * product left out (or qty 0) is removed. Prices are the party's own, worked out here again; the change goes in the
 * order's history under the officer's name.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const login = await sfFromRequest(req);
  if (!login) return fail(401, "Please sign in again.");
  if (tooMany(req, "sf-order-edit", 30)) return fail(429, "Too many changes. Please wait a minute.");
  const id = Number((await params).orderId);
  if (!Number.isInteger(id) || id < 1) return fail(404, "Order not found.");
  const b = (await readJson(req, 20_000)) as { lines?: unknown } | null;
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
  const r = await editOrderFromApp(login, id, lines, packs);
  return r.ok ? NextResponse.json({ ok: true }) : fail(400, r.error);
}
