import { NextResponse, type NextRequest } from "next/server";
import { query } from "@/lib/db";
import { getOrder, getOrderMedia, type Message } from "@/lib/whatsapp/store";
import { requireSession } from "@/lib/whatsapp/session";
import { labelOf, productLabels } from "@/lib/products/names";

export const dynamic = "force-dynamic";

/** One order with its items, every photo/file tied to it, its messages and its review. */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/whatsapp/orders/[id]">) {
  const denied = await requireSession(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  const got = /^\d+$/.test(id) ? await getOrder(Number(id)) : null;
  if (!got) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [media, review, messages, all] = await Promise.all([
    getOrderMedia(got.order.id),
    query<{ rating: number; comment: string | null; created_at: string }>(
      `select rating, comment, created_at from wa_review where order_id = $1`, [got.order.id],
    ),
    query<Pick<Message, "id" | "direction" | "sender" | "type" | "body" | "created_at" | "status">>(
      `select id, direction, sender, type, body, created_at, status from wa_message
        where order_id = $1 order by created_at`, [got.order.id],
    ),
    productLabels(),
  ]);
  // each item as the dashboard names the product (the WhatsApp catalog keeps its own names for customers)
  const labels = Object.fromEntries(got.items.map((i) => [i.retailer_id, labelOf(all, i.retailer_id, i.name, i.image_url)]));
  return NextResponse.json({ ...got, media, review: review[0] ?? null, messages, labels });
}
