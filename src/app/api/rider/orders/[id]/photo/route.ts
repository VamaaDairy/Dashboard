import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { one } from "@/lib/db";
import { riderFromRequest } from "@/lib/shop/rider";
import { decodeImage, folderFor, savePhoto } from "@/lib/photos";

export const dynamic = "force-dynamic";

/**
 * The delivery boy's photo of the drop (optional): one of their own orders, on the way or delivered in the last day.
 * Body: { image: base64 JPEG / PNG }. Saved in deliveries/home/<month>/<day>/order-<no>/ on the server.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const rider = await riderFromRequest(req);
  if (!rider) return fail(401, "Please sign in again.");
  if (tooMany(req, "drop-photo", 20)) return fail(429, "Too many photos. Please wait a minute.");
  const id = Number((await ctx.params).id);
  const o = Number.isInteger(id)
    ? await one<{ order_no: string | null }>(
        `select order_no from shop_order where id = $1 and rider_id = $2
            and (status = 'out_for_delivery' or (status = 'delivered' and delivered_at > now() - interval '1 day'))`,
        [id, rider.id],
      )
    : null;
  if (!o) return fail(404, "This order is not on your list.");
  const b = (await readJson(req, 6_000_000)) as { image?: unknown } | null;
  const img = decodeImage(b?.image);
  if ("error" in img) return fail(400, img.error);
  const p = await savePhoto("delivery_home", String(id), folderFor("delivery_home", { orderNo: o.order_no ?? id }), img, `${rider.name} (rider)`);
  return NextResponse.json({ photo: p }, { status: 201 });
}
