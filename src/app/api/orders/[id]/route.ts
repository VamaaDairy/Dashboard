import { NextResponse, type NextRequest } from "next/server";
import { one } from "@/lib/db";
import { apiCaller, apiError, can, forbidden, jsonBody, unauthorised, type ApiCaller } from "@/lib/api/access";
import { getTradeOrder } from "@/lib/app-orders";
import { cancelOrder, CANCELLED, confirmOrders, CONFIRMED, editOrder, orderEvents, reopenOrder } from "@/lib/orders/direct";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Distributor / retailer orders: the same permission as App orders (or the portal's order screen). */
const may = (c: ApiCaller, need: "view" | "edit") => can(c, "apporders", need) || can(c, "fp.portalOrder", need);

/** The order's uid from its number (as the apps and invoices show it) or its uid. */
async function uidOf(id: string): Promise<string | null> {
  if (/^[0-9a-f-]{36}$/i.test(id)) return id;
  if (!/^\d{1,9}$/.test(id)) return null;
  return (await one<{ uid: string }>(`select uid from fp_booking_order where order_id = $1`, [Number(id)]))?.uid ?? null;
}

async function access(req: NextRequest, ctx: Ctx, need: "view" | "edit") {
  const caller = await apiCaller(req);
  if (!caller) return { error: unauthorised() } as const;
  if (!may(caller, need)) return { error: forbidden() } as const;
  const uid = await uidOf((await ctx.params).id);
  if (!uid) return { error: apiError(404, "No such order.") } as const;
  return { caller, uid } as const;
}

/** One distributor or retailer order by its number: buyer, supplier, lines (with the CRT / PCS split) and history. */
export async function GET(req: NextRequest, ctx: Ctx) {
  const a = await access(req, ctx, "view");
  if ("error" in a) return a.error;
  const order = await getTradeOrder(a.uid);
  if (!order) return apiError(404, "No such order.");
  return NextResponse.json({ order, history: await orderEvents(a.uid) });
}

/**
 * The office acts on the order, as on App orders. Body: { "action": "confirm" } | { "action": "cancel", "reason": "..." }
 * | { "action": "reopen", "reason": "..." } | { "action": "edit", "lines": [{ "sku", "qty", "packs"? }], "note"? }.
 * Every step goes into the order's history with who did it, and the buyer's phone is notified.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const a = await access(req, ctx, "edit");
  if ("error" in a) return a.error;
  const b = await jsonBody(req, 50_000);
  const action = b?.action;
  const who = { name: a.caller.who, kind: "office" as const };
  const reason = typeof b?.reason === "string" ? b.reason.trim() : "";

  if (action === "confirm") {
    const r = await confirmOrders([a.uid], who);
    return r.confirmed ? NextResponse.json({ ok: true, status: CONFIRMED }) : apiError(409, r.errors[0] ?? "Could not confirm.");
  }
  if (action === "cancel" || action === "reopen") {
    if (!reason) return apiError(400, `Give a reason for ${action === "cancel" ? "cancelling" : "reopening"}.`);
    const r = action === "cancel" ? await cancelOrder(a.uid, who, reason) : await reopenOrder(a.uid, who, reason);
    return r.ok ? NextResponse.json({ ok: true, ...(action === "cancel" ? { status: CANCELLED } : {}) }) : apiError(409, r.error);
  }
  if (action === "edit") {
    if (!Array.isArray(b?.lines) || b.lines.length > 200) return apiError(400, "Send lines: [{ sku, qty, packs? }] - the whole new order.");
    const lines = new Map<string, number>();
    const packs = new Map<string, number>();
    for (const l of b.lines as Array<Record<string, unknown>>) {
      const sku = String(l?.sku ?? "");
      const qty = Number(l?.qty);
      if (!sku || !Number.isInteger(qty) || qty < 0 || qty > 100_000) return apiError(400, "Check the quantities.");
      lines.set(sku, (lines.get(sku) ?? 0) + qty);
      if (l?.packs !== undefined && l?.packs !== null) {
        const p = Number(l.packs);
        if (!Number.isInteger(p) || p < 0 || p > qty) return apiError(400, "Check the quantities.");
        packs.set(sku, (packs.get(sku) ?? 0) + p);
      }
    }
    const r = await editOrder(a.uid, lines, who, typeof b.note === "string" ? b.note : null, packs);
    return r.ok ? NextResponse.json({ ok: true }) : apiError(409, r.error);
  }
  return apiError(400, 'Send { "action": "confirm" | "cancel" | "reopen" | "edit", ... }.');
}
