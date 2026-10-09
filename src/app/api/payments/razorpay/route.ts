import { createHmac, timingSafeEqual } from "node:crypto";
import { after, NextResponse, type NextRequest } from "next/server";
import { one } from "@/lib/db";
import { razorpay } from "@/lib/whatsapp/config";
import { notifyPaid } from "@/lib/whatsapp/flow";
import { updateOrder } from "@/lib/whatsapp/store";

export const dynamic = "force-dynamic";

/** Razorpay says a payment link was paid: the order is marked paid and the customer told. */
export async function POST(req: NextRequest) {
  if (!razorpay.webhookSecret) return new NextResponse("Not configured", { status: 404 });
  const raw = await req.text();
  const sig = req.headers.get("x-razorpay-signature") ?? "";
  const expected = createHmac("sha256", razorpay.webhookSecret).update(raw).digest("hex");
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return new NextResponse("Bad signature", { status: 401 });
  }

  const event = JSON.parse(raw) as {
    event: string;
    payload?: { payment_link?: { entity?: { id: string; reference_id?: string } }; payment?: { entity?: { id: string } } };
  };
  if (event.event === "payment_link.paid") {
    const link = event.payload?.payment_link?.entity;
    const order = link?.reference_id
      ? await one<{ id: number; payment_status: string }>(`select id, payment_status from wa_order where order_no = $1`, [link.reference_id])
      : null;
    if (order && order.payment_status !== "paid") {
      await updateOrder(order.id, { payment_status: "paid", payment_ref: event.payload?.payment?.entity?.id ?? link?.id ?? null });
      after(() => notifyPaid(order.id));
    }
  }
  return NextResponse.json({ ok: true });
}
