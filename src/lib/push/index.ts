import "server-only";
import { createHash } from "node:crypto";
import { one, query } from "@/lib/db";
import { pushConfigured, sendPush, type PushMessage } from "./fcm";

export type PushRole = "customer" | "rider" | "distributor";

const hashSession = (bearer: string) => createHash("sha256").update(bearer).digest("hex");

/** The Bearer token of a request, if it is shaped like one of ours. */
export const bearerOf = (authorization: string | null) => /^Bearer ([0-9a-f]{64})$/.exec(authorization ?? "")?.[1] ?? null;

/** Remembers this phone for a signed-in role. The same phone can be registered for several roles. */
export async function registerDevice(role: PushRole, ownerId: number, bearer: string, token: string, platform: "android" | "ios") {
  await query(
    `insert into push_device (token, role, owner_id, session_hash, platform) values ($1, $2, $3, $4, $5)
     on conflict (token, role) do update set owner_id = $3, session_hash = $4, platform = $5, updated_at = now()`,
    [token, role, ownerId, hashSession(bearer), platform],
  );
}

export const unregisterDevice = (role: PushRole, token: string) => query(`delete from push_device where token = $1 and role = $2`, [token, role]);

/** Phones to push to for one account: only those registered with that account's live session. */
const LIVE: Record<PushRole, string> = {
  customer: `select d.token from push_device d
               join shop_customer_session s on encode(sha256(convert_to(s.token, 'UTF8')), 'hex') = d.session_hash and s.customer_id = d.owner_id
              where d.role = 'customer' and d.owner_id = $1`,
  rider: `select d.token from push_device d
            join shop_rider r on r.id = d.owner_id and r.active and encode(sha256(convert_to(r.token, 'UTF8')), 'hex') = d.session_hash
           where d.role = 'rider' and d.owner_id = $1`,
  distributor: `select d.token from push_device d
                  join dist_login l on l.id = d.owner_id and l.active and encode(sha256(convert_to(l.token, 'UTF8')), 'hex') = d.session_hash
                 where d.role = 'distributor' and d.owner_id = $1`,
};

/** Pushes to every live phone of one account. Never throws: a failed notification must not fail the action behind it. */
export async function notify(role: PushRole, ownerId: number | null | undefined, m: PushMessage): Promise<void> {
  if (ownerId == null || !pushConfigured()) return;
  try {
    const rows = await query<{ token: string }>(LIVE[role], [ownerId]);
    await Promise.all(
      [...new Set(rows.map((r) => r.token))].map(async (token) => {
        if ((await sendPush({ token }, m)) === "gone") await unregisterDevice(role, token);
      }),
    );
  } catch (e) {
    console.error("[push] notify failed:", e);
  }
}

/** Pushes to everyone subscribed to a topic (every phone is on "all"). */
export async function notifyTopic(topic: string, m: PushMessage): Promise<void> {
  if (!pushConfigured()) return;
  await sendPush({ topic }, m);
}

// ---- shop orders ----

const FOR_CUSTOMER: Record<string, (no: string, otp: string) => PushMessage> = {
  placed: (no) => ({ title: "Order placed", body: `We have your order ${no}. We will confirm it shortly.` }),
  confirmed: (no) => ({ title: "Order confirmed", body: `Your order ${no} is confirmed and being prepared.` }),
  out_for_delivery: (no, otp) => ({ title: "On its way", body: `Your order ${no} is out for delivery. Delivery code: ${otp}` }),
  delivered: (no) => ({ title: "Delivered", body: `Your order ${no} was delivered. Thank you for choosing Gaia!` }),
  cancelled: (no) => ({ title: "Order cancelled", body: `Your order ${no} was cancelled.` }),
};

/** Tells the customer an order reached a new status (nothing for orders placed without an account). */
export async function notifyOrderStatus(orderId: number, status: string): Promise<void> {
  const make = FOR_CUSTOMER[status];
  if (!make || !pushConfigured()) return;
  try {
    const o = await one<{ order_no: string; access_key: string; customer_id: number | null; delivery_otp: string }>(
      `select order_no, access_key, customer_id, delivery_otp from shop_order where id = $1`,
      [orderId],
    );
    if (o) await notify("customer", o.customer_id, { ...make(o.order_no, o.delivery_otp), data: { type: "order", status, orderKey: o.access_key } });
  } catch (e) {
    console.error("[push] order notification failed:", e);
  }
}

/** Tells a rider an order was given to them. */
export async function notifyRiderAssigned(orderId: number, riderId: number): Promise<void> {
  try {
    const o = await one<{ order_no: string; address: string }>(`select order_no, address from shop_order where id = $1`, [orderId]);
    if (o) await notify("rider", riderId, { title: "New delivery", body: `${o.order_no} - ${o.address}`.slice(0, 160), data: { type: "assigned", orderId: String(orderId) } });
  } catch (e) {
    console.error("[push] rider notification failed:", e);
  }
}
