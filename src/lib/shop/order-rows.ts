import "server-only";
import type { OrderRow } from "@/components/shop/OrdersTable";
import { labelOf, type ProductLabel } from "@/lib/products/names";
import { STATUS_LABEL } from "./pricing";
import { trackingOf, type BoardRow } from "./order-board";

const placed = (d: Date) => new Date(d).toLocaleString("en-GB", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const dayOnly = (d: string | Date) => new Date(d).toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });

/** One order as a row of the D2C orders table - the same everywhere that table is shown. */
export function toOrderRow(o: BoardRow, labels: Map<number, ProductLabel>, now = new Date()): OrderRow {
  const tr = trackingOf(o, now);
  return {
    id: o.id,
    orderNo: o.order_no,
    placed: placed(o.created_at),
    type: o.subscription_day ? `Subscription · ${dayOnly(o.subscription_day)}` : "Regular",
    subscription: !!o.subscription_day,
    name: o.name,
    phone: o.phone,
    nth: o.nth,
    address: o.address,
    pincode: o.pincode,
    noPin: o.lat === null,
    note: o.notes,
    items: o.items.map((i) => { const l = labelOf(labels, i.sku_code, i.name, i.image_url); return { name: l.name, image: l.image, qty: i.qty }; }),
    qty: o.items.reduce((a, i) => a + i.qty, 0),
    subtotal: Number(o.subtotal),
    deliveryFee: Number(o.delivery_fee),
    total: Number(o.total),
    payMethod: o.payment_method === "cod" ? "Cash on delivery" : o.payment_method === "autopay" ? "Autopay" : o.payment_method === "prepaid" ? "Subscription pack" : "Online",
    paid: o.payment_status === "paid"
      ? { label: o.payment_method === "cod" ? "Collected" : "Paid", tone: "good" }
      : o.payment_status === "refunded" ? { label: "Refunded", tone: "bad" }
      : o.status === "cancelled" ? { label: "Not paid", tone: "bad" }
      : { label: o.payment_method === "cod" ? "To collect" : "Pending", tone: "wait" },
    status: o.status,
    statusLabel: o.status === "placed" ? "New" : STATUS_LABEL[o.status] ?? o.status,
    tracking: { ...tr, route: !!o.picked_up_at },
    rider: o.rider?.name ?? null,
    stop: o.delivery_seq ? `stop ${o.delivery_seq}` : null,
  };
}
