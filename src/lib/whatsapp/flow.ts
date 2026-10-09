import "server-only";
import { razorpay, shop } from "./config";
import {
  getOrder, inStock, listProducts, money, saveReview, send, sendText, updateContact, updateOrder,
  type Order, type OrderItem, type OrderStatus,
} from "./store";

/** What happens to an order after it's placed: payment requests, status messages, the review request. */

export function orderSummary(order: Order, items: OrderItem[]) {
  const lines = items.map((i) => `• ${i.name} × ${i.qty} = ${money(i.line_total, order.currency)}`);
  return [
    `*Order ${order.order_no}*`,
    ...lines,
    order.delivery_fee ? `Delivery: ${money(order.delivery_fee, order.currency)}` : null,
    `*Total: ${money(order.total, order.currency)}*`,
    order.delivery_address ? `Deliver to: ${order.delivery_name ? `${order.delivery_name}, ` : ""}${order.delivery_address}` : null,
  ].filter(Boolean).join("\n");
}

// ---------------------------------------------------------------- payment

export const onlinePaymentMethod = (): "link" | "upi" | null =>
  razorpay.keyId && razorpay.keySecret ? "link" : shop.upiId ? "upi" : null;

async function createRazorpayLink(order: Order): Promise<{ id: string; url: string }> {
  const res = await fetch("https://api.razorpay.com/v1/payment_links", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${razorpay.keyId}:${razorpay.keySecret}`).toString("base64")}`,
    },
    body: JSON.stringify({
      amount: Math.round(order.total * 100),
      currency: order.currency || "INR",
      description: `${shop.name} order ${order.order_no}`,
      reference_id: order.order_no,
      customer: { name: order.delivery_name ?? order.customer_name ?? undefined, contact: `+${order.wa_id}` },
      notify: { sms: false, email: false },
      reminder_enable: false,
      notes: { order_id: String(order.id), wa_id: order.wa_id },
    }),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.description ?? `Razorpay ${res.status}`);
  return { id: data.id, url: data.short_url };
}

/** Sends the customer how to pay for an order they've just placed. */
export async function sendPaymentRequest(orderId: number) {
  const got = await getOrder(orderId);
  if (!got) return;
  const { order, items } = got;
  const summary = orderSummary(order, items);

  if (order.payment_method === "cod") {
    await sendText(order.wa_id, `${summary}\n\n✅ Order placed - pay *${money(order.total, order.currency)}* in cash on delivery. We'll message you when it's confirmed.`, "bot", order.id);
    return;
  }

  if (order.payment_method === "link") {
    try {
      const link = await createRazorpayLink(order);
      await updateOrder(order.id, { payment_link: link.url, payment_ref: link.id });
      await sendText(order.wa_id, `${summary}\n\n💳 Pay securely here: ${link.url}\n\nWe'll confirm automatically once the payment goes through.`, "bot", order.id);
      return;
    } catch (e) {
      console.error("[whatsapp] razorpay link failed:", e);
      if (!shop.upiId) {
        await sendText(order.wa_id, `${summary}\n\nWe couldn't create a payment link right now - our team will send you payment details shortly.`, "bot", order.id);
        return;
      }
      // fall through to plain UPI
    }
  }

  const upi = `upi://pay?pa=${encodeURIComponent(shop.upiId)}&pn=${encodeURIComponent(shop.upiName)}&am=${order.total.toFixed(2)}&cu=INR&tn=${encodeURIComponent(order.order_no)}`;
  await sendText(
    order.wa_id,
    `${summary}\n\n💳 Please pay *${money(order.total, order.currency)}* by UPI to *${shop.upiId}* (${shop.upiName}).\n${upi}\n\nAfter paying, send a *screenshot* of the payment here and we'll confirm your order.`,
    "bot",
    order.id,
  );
}

// ---------------------------------------------------------------- catalog card set

/**
 * The full shop window: a greeting, one photo card per product, then a
 * tap-to-order list. Picking a row comes back as an interactive reply the
 * assistant turns into a cart.
 */
export async function sendCatalog(waId: string, sender: "agent" | "bot" = "agent") {
  const products = (await listProducts()).filter(inStock);
  if (!products.length) throw new Error("No products in stock to send");

  await sendText(
    waId,
    [
      `*Welcome to ${shop.name}*`,
      "",
      "Farm-fresh milk, dahi, ghee and sweets - pasteurised, antibiotic free and untouched by hand, delivered to your doorstep.",
      "",
      "Our current range is below. To order, tap *Order Now* at the end, or reply with the items and quantities you need (for example: _2 Cow Milk, 1 Doodh Peda_).",
    ].join("\n"),
    sender,
  );

  for (const p of products) {
    const caption = [`*${p.name}*`, `*${money(p.price, p.currency)}*`, p.description ? `\n${p.description}` : null]
      .filter(Boolean)
      .join("\n");
    if (p.image_url) await send(waId, { type: "image", image: { link: p.image_url, caption } }, { sender });
    else await sendText(waId, caption, sender);
  }

  const rows = products.slice(0, 10).map((p) => ({
    id: `add:${p.retailer_id}`,
    title: shortName(p.name).slice(0, 24),
    description: `${money(p.price, p.currency)} - ${firstClause(p.description)}`.slice(0, 72),
  }));
  const delivery = shop.freeDeliveryAbove
    ? `\n\nFree delivery on orders above ${money(shop.freeDeliveryAbove)}.`
    : "";
  await send(
    waId,
    {
      type: "interactive",
      interactive: {
        type: "list",
        header: { type: "text", text: `${shop.name} - Place your order`.slice(0, 60) },
        body: {
          text: `Select a product to add it to your cart. You can add more items and change quantities at any time.\n\nAt checkout we'll confirm your delivery address and payment - UPI or Cash on Delivery.${delivery}`,
        },
        footer: { text: "Questions? Just reply to this chat." },
        action: { button: "Order Now", sections: [{ title: "Available today", rows }] },
      },
    },
    { sender, body: "Order Now - product list" },
  );
}

const shortName = (name: string) => name.replace(/^Gaia\s+/i, "").replace(/Thick & Creamy /i, "");
const firstClause = (text: string) => text.split(/[.,]/)[0].trim();

// ---------------------------------------------------------------- status changes from the dashboard

const STATUS_TEXT: Record<OrderStatus, (o: Order) => string> = {
  placed: (o) => `Your order ${o.order_no} has been received.`,
  confirmed: (o) => `✅ Your order *${o.order_no}* is confirmed. We're getting it ready.`,
  packed: (o) => `📦 Your order *${o.order_no}* is packed and will be on its way soon.`,
  shipped: (o) => `🚚 Your order *${o.order_no}* is out for delivery.`,
  delivered: (o) => `🎉 Your order *${o.order_no}* has been delivered. Thank you for shopping with ${shop.name}!`,
  cancelled: (o) => `Your order *${o.order_no}* has been cancelled. Reply here if you have any questions.`,
};

export async function notifyStatus(orderId: number, status: OrderStatus) {
  const got = await getOrder(orderId);
  if (!got) return;
  await sendText(got.order.wa_id, STATUS_TEXT[status](got.order), "system", orderId);
  if (status === "delivered") await sendReviewRequest(orderId);
}

export async function notifyPaid(orderId: number) {
  const got = await getOrder(orderId);
  if (!got) return;
  await sendText(got.order.wa_id, `💰 Payment of *${money(got.order.total, got.order.currency)}* received for order *${got.order.order_no}*. Thank you!`, "system", orderId);
}

// ---------------------------------------------------------------- reviews

export async function sendReviewRequest(orderId: number) {
  const got = await getOrder(orderId);
  if (!got) return;
  const o = got.order;
  await send(
    o.wa_id,
    {
      type: "interactive",
      interactive: {
        type: "list",
        header: { type: "text", text: "How did we do?" },
        body: { text: `Please rate your order ${o.order_no} from ${shop.name}.` },
        footer: { text: "Tap a rating" },
        action: {
          button: "Rate order",
          sections: [{
            title: "Your rating",
            rows: [5, 4, 3, 2, 1].map((n) => ({
              id: `rate:${o.id}:${n}`,
              title: `${"⭐".repeat(n)}`,
              description: ["", "Poor", "Not great", "Okay", "Good", "Excellent"][n],
            })),
          }],
        },
      },
    },
    { sender: "system", orderId, body: `Asked for a rating of ${o.order_no}` },
  );
}

/** A tap on one of the rating rows. Their next text becomes the comment. */
export async function handleRatingReply(waId: string, replyId: string): Promise<boolean> {
  const m = replyId.match(/^rate:(\d+):([1-5])$/);
  if (!m) return false;
  const orderId = Number(m[1]);
  const rating = Number(m[2]);
  const got = await getOrder(orderId);
  if (!got || got.order.wa_id !== waId) return false;
  await saveReview({ waId, orderId, rating });
  await updateContact(waId, { pending_review_order_id: orderId });
  await sendText(
    waId,
    rating >= 4
      ? `Thank you for the ${rating}⭐ rating! 🙏 Anything you'd like to tell us about the products? Just type it here (or say "skip").`
      : `Thanks for rating us ${rating}⭐. We're sorry it wasn't better - what went wrong? Your feedback goes straight to our team.`,
    "system",
    orderId,
  );
  return true;
}
