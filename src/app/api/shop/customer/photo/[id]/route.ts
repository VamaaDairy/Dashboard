import type { NextRequest } from "next/server";
import { fail } from "@/lib/shop/api";
import { customerFromRequest } from "@/lib/shop/customer";
import { imageResponse, readPhoto } from "@/lib/photos";

export const dynamic = "force-dynamic";

/** One of the signed-in customer's own delivery-spot photos. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const c = await customerFromRequest(req);
  if (!c) return fail(401, "Please sign in again.");
  const p = await readPhoto(Number((await ctx.params).id), { kind: "customer_location", ref: String(c.id) });
  return p ? imageResponse(p) : fail(404, "Photo not found.");
}
