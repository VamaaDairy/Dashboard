import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { one } from "@/lib/db";
import { riderFromRequest } from "@/lib/shop/rider";
import { decodeImage, folderFor, savePhoto } from "@/lib/photos";

export const dynamic = "force-dynamic";

/**
 * The transporter's photo of a trip stop's drop (optional): a stop on one of their own trips, on the road or ended in the
 * last day. Body: { image: base64 JPEG / PNG }. Saved in deliveries/trade/<month>/<day>/order-<no>/ on the server.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const rider = await riderFromRequest(req);
  if (!rider) return fail(401, "Please sign in again.");
  if (tooMany(req, "stop-photo", 20)) return fail(429, "Too many photos. Please wait a minute.");
  const id = Number((await ctx.params).id);
  const s = Number.isInteger(id)
    ? await one<{ uid: string; order_id: number }>(
        `select b.uid, b.order_id from dist_trip_stop s join dist_trip t on t.id = s.trip_id join fp_booking_order b on b.uid = s.order_uid
          where s.id = $1 and t.transporter_id = $2 and (t.status = 'on_the_way' or (t.status = 'completed' and t.ended_at > now() - interval '1 day'))`,
        [id, rider.id],
      )
    : null;
  if (!s) return fail(404, "This stop is not on your trip.");
  const b = (await readJson(req, 6_000_000)) as { image?: unknown } | null;
  const img = decodeImage(b?.image);
  if ("error" in img) return fail(400, img.error);
  const p = await savePhoto("delivery_trade", s.uid, folderFor("delivery_trade", { orderNo: s.order_id }), img, `${rider.name} (transporter)`);
  return NextResponse.json({ photo: p }, { status: 201 });
}
