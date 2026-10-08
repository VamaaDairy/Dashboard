import { NextResponse, type NextRequest } from "next/server";
import { query } from "@/lib/db";
import { getContact, getMessages, listOrders, priceCart } from "@/lib/whatsapp/store";
import { requireSession } from "@/lib/whatsapp/session";

export const dynamic = "force-dynamic";

/** One conversation: the contact, its messages, cart and orders. Opening it marks it read. */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/whatsapp/conversations/[waId]">) {
  const denied = await requireSession(req);
  if (denied) return denied;
  const { waId } = await ctx.params;
  const contact = await getContact(waId);
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (contact.unread) await query(`update wa_contact set unread = 0 where wa_id = $1`, [waId]);
  const [messages, orders, cart] = await Promise.all([getMessages(waId), listOrders({ waId }), priceCart(contact.cart)]);
  // WhatsApp only delivers free-form messages within 24 hours of the customer's last one.
  const windowOpen = !!contact.last_inbound_at && Date.now() - new Date(contact.last_inbound_at).getTime() < 24 * 3600_000;
  return NextResponse.json({ contact: { ...contact, unread: 0 }, messages, orders, cart, windowOpen });
}
