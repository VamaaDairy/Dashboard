import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { riderDeliver } from "@/lib/shop/orders";
import { riderFromRequest } from "@/lib/shop/rider";

export const dynamic = "force-dynamic";

/** Handover done: the customer's 4-digit code completes the order. Body: { otp } */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (tooMany(req, "rider-deliver", 20)) return fail(429, "Too many attempts. Please wait a minute.");
  const rider = await riderFromRequest(req);
  if (!rider) return fail(401, "Please sign in again.");
  const id = Number((await ctx.params).id);
  const b = (await readJson(req, 500)) as { otp?: unknown } | null;
  const otp = String(b?.otp ?? "").trim();
  if (!Number.isInteger(id)) return fail(404, "This order is not on your list.");
  if (!/^\d{4}$/.test(otp)) return fail(400, "Enter the 4-digit code the customer has.");
  const r = await riderDeliver(rider.id, id, otp);
  if (r === "wrong_otp") return fail(400, "That code is not right. Ask the customer to check their order screen.");
  if (r === "not_found") return fail(404, "This order is not out for delivery on your list.");
  return NextResponse.json({ ok: true });
}
