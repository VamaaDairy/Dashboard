import { NextResponse, type NextRequest } from "next/server";
import { fail, orderJson, readJson, tooMany } from "@/lib/shop/api";
import { getOrderByKey, rateDelivery } from "@/lib/shop/orders";

export const dynamic = "force-dynamic";

/** The customer rates the delivery partner of a delivered order. Body: { stars: 1-5, note? }. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  if (tooMany(req, "order-rating", 10)) return fail(429, "Too many requests. Please wait a minute.");
  const { key } = await ctx.params;
  const b = (await readJson(req, 2000)) as { stars?: unknown; note?: unknown } | null;
  const stars = Number(b?.stars);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return fail(400, "Choose 1 to 5 stars.");
  const r = await rateDelivery(key, stars, String(b?.note ?? "").trim());
  if (!r.ok) return fail(r.status, r.error);
  return NextResponse.json(orderJson((await getOrderByKey(key))!));
}
