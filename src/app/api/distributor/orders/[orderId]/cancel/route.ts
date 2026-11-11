import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { distFromRequest } from "@/lib/distributor";
import { cancelOrderFromApp } from "@/lib/orders/direct";

export const dynamic = "force-dynamic";

/** The buyer cancels their own pending order before the cutoff. Body (optional): { reason } */
export async function POST(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const login = await distFromRequest(req);
  if (!login) return fail(401, "Please sign in again.");
  if (tooMany(req, "dist-order-cancel", 20)) return fail(429, "Please wait a minute.");
  const id = Number((await params).orderId);
  if (!Number.isInteger(id) || id < 1) return fail(404, "Order not found.");
  const b = (await readJson(req, 2_000)) as { reason?: unknown } | null;
  const r = await cancelOrderFromApp(login, id, typeof b?.reason === "string" ? b.reason.slice(0, 300) : undefined);
  return r.ok ? NextResponse.json({ ok: true }) : fail(400, r.error);
}
