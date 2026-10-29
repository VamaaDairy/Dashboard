import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { one, query, tx } from "@/lib/db";
import { notifyOrderStatus } from "@/lib/push";

/**
 * Easebuzz payment gateway, for Gaia app orders paid online (migration 069).
 *
 *   1. startPayment: our server asks Easebuzz for an access key for one attempt (Initiate Payment API,
 *      signed with the salt, which never leaves the server) and gives the key to the app.
 *   2. The app opens Easebuzz's checkout with that key (UPI, cards, net banking).
 *   3. Easebuzz tells us the result - its webhook and the success / failure URL both land on
 *      /api/payments/easebuzz - and the app asks us to check (Transaction API). Each reply is accepted only
 *      when its hash, made with our salt, matches; a success also has to be for the amount we asked.
 *   4. A confirmed payment marks the order paid and places it. Nothing the phone says is trusted.
 *
 * Settings (.env): EASEBUZZ_KEY, EASEBUZZ_SALT, EASEBUZZ_ENV ("prod" for live money, anything else = test),
 * EASEBUZZ_EMAIL (sent as the payer's email, which Easebuzz requires and our customers do not give).
 * Hash orders are the ones in Easebuzz's own server library (github.com/easebuzz).
 */

const KEY = process.env.EASEBUZZ_KEY ?? "";
const SALT = process.env.EASEBUZZ_SALT ?? "";
const LIVE = process.env.EASEBUZZ_ENV === "prod";
const PAY_URL = LIVE ? "https://pay.easebuzz.in/" : "https://testpay.easebuzz.in/";
const DASH_URL = LIVE ? "https://dashboard.easebuzz.in/" : "https://testdashboard.easebuzz.in/";
const EMAIL = process.env.EASEBUZZ_EMAIL ?? "payments@vamaadairy.com";
const PUBLIC_URL = (process.env.SHOP_PUBLIC_URL ?? "https://production.vamadairy.in").replace(/\/+$/, "");
/** Where Easebuzz sends the result (success and failure alike); the webhook in its dashboard points here too. */
export const RETURN_URL = `${PUBLIC_URL}/api/payments/easebuzz`;

export const easebuzzReady = () => !!KEY && !!SALT;
/** What the app passes to the Easebuzz checkout. */
export const payMode = () => (LIVE ? "production" : "test");

const sha512 = (s: string) => createHash("sha512").update(s, "utf8").digest("hex").toLowerCase();
const UDF = ["udf1", "udf2", "udf3", "udf4", "udf5", "udf6", "udf7", "udf8", "udf9", "udf10"];
const field = (o: Record<string, unknown>, k: string) => (o[k] === undefined || o[k] === null ? "" : String(o[k]));

/** key|txnid|amount|productinfo|firstname|email|udf1..udf10|salt */
const requestHash = (p: Record<string, string>) =>
  sha512([...["key", "txnid", "amount", "productinfo", "firstname", "email", ...UDF].map((k) => field(p, k)), SALT].join("|"));

/** salt|status|udf10..udf1|email|firstname|productinfo|amount|txnid|key - how Easebuzz signs what it sends back. */
const replyHash = (r: Record<string, unknown>) =>
  sha512([SALT, field(r, "status"), ...[...UDF].reverse().map((k) => field(r, k)), ...["email", "firstname", "productinfo", "amount", "txnid", "key"].map((k) => field(r, k))].join("|"));

const sameHash = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** A reply really from Easebuzz, for our account. */
function verified(r: Record<string, unknown>): boolean {
  const hash = field(r, "hash").toLowerCase();
  return !!SALT && !!hash && field(r, "key") === KEY && sameHash(replyHash(r), hash);
}

const money = (n: number) => Number(n).toFixed(2);
// Easebuzz rejects names with symbols; keep letters, digits and spaces
const cleanName = (s: string) => s.replace(/[^A-Za-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 50) || "Gaia Customer";

async function post(url: string, body: Record<string, string>): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams(body).toString(),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Easebuzz answered ${res.status}: ${text.slice(0, 200)}`);
  }
}

interface PayOrder {
  id: number;
  order_no: string;
  access_key: string;
  name: string;
  phone: string;
  total: number;
  status: string;
  payment_method: string;
  payment_status: string;
  customer_id: number | null;
}

const ORDER = `select id, order_no, access_key, name, phone, total::float as total, status, payment_method, payment_status, customer_id from shop_order`;

export type StartResult = { ok: true; accessKey: string; mode: string; txnid: string } | { ok: false; status: number; error: string };

/** A new payment attempt for an order awaiting online payment; returns the key the app opens Easebuzz with. */
export async function startPayment(orderKey: string, customerId: number): Promise<StartResult> {
  if (!easebuzzReady()) return { ok: false, status: 503, error: "Online payment is not available right now. Please choose cash on delivery." };
  const o = await one<PayOrder>(`${ORDER} where access_key = $1`, [orderKey]);
  if (!o || o.customer_id !== customerId) return { ok: false, status: 404, error: "Order not found." };
  if (o.payment_status === "paid") return { ok: false, status: 409, error: "This order is already paid." };
  if (o.status !== "awaiting_payment" || o.payment_method !== "online") return { ok: false, status: 409, error: "This order is not waiting for an online payment." };

  const tries = (await one<{ n: number }>(`select count(*)::int as n from shop_payment where order_id = $1`, [o.id]))?.n ?? 0;
  if (tries >= 10) return { ok: false, status: 429, error: "Too many payment attempts for this order. Please choose cash on delivery." };

  const txnid = `${o.order_no}-${tries + 1}`;
  const params: Record<string, string> = {
    key: KEY,
    txnid,
    amount: money(o.total),
    productinfo: `Gaia order ${o.order_no}`,
    firstname: cleanName(o.name),
    email: EMAIL,
    phone: o.phone,
    surl: RETURN_URL,
    furl: RETURN_URL,
    udf1: o.order_no,
  };
  params.hash = requestHash(params);
  await query(`insert into shop_payment (order_id, txnid, amount) values ($1, $2, $3)`, [o.id, txnid, o.total]);

  let reply: Record<string, unknown>;
  try {
    reply = await post(`${PAY_URL}payment/initiateLink`, params);
  } catch (e) {
    console.error("[easebuzz] initiate failed:", e);
    await query(`update shop_payment set status = 'error', updated_at = now() where txnid = $1`, [txnid]);
    return { ok: false, status: 502, error: "Could not reach the payment gateway. Please try again." };
  }
  if (Number(reply.status) !== 1 || typeof reply.data !== "string" || !reply.data) {
    console.error("[easebuzz] initiate refused:", JSON.stringify(reply).slice(0, 500));
    await query(`update shop_payment set status = 'error', raw = $2, updated_at = now() where txnid = $1`, [txnid, JSON.stringify(reply)]);
    return { ok: false, status: 502, error: "The payment could not be started. Please try again or choose cash on delivery." };
  }
  await query(`update shop_payment set access_key = $2, updated_at = now() where txnid = $1`, [txnid, reply.data]);
  return { ok: true, accessKey: reply.data, mode: payMode(), txnid };
}

export type ApplyResult = { ok: true; status: string; orderId: number } | { ok: false; error: string };

/**
 * Records what Easebuzz says about a payment - from the webhook, the success / failure URL or the
 * Transaction API. Only signed replies for our own txnid count; a success must be for the amount asked.
 * Safe to call any number of times: the order is paid and placed once.
 */
export async function applyReply(r: Record<string, unknown>, source: string): Promise<ApplyResult> {
  if (!verified(r)) {
    console.error(`[easebuzz] ${source}: reply with a wrong or missing hash for txnid ${field(r, "txnid")}`);
    return { ok: false, error: "Hash mismatch" };
  }
  const txnid = field(r, "txnid");
  const status = field(r, "status").toLowerCase() || "unknown";
  const placed = await tx(async (c) => {
    const pay = (await c.query<{ id: number; order_id: number; amount: number; status: string }>(
      `select id, order_id, amount::float as amount, status from shop_payment where txnid = $1 for update`,
      [txnid],
    )).rows[0];
    if (!pay) return { error: "Unknown txnid" };
    if (status === "success" && Math.abs(Number(field(r, "amount")) - pay.amount) > 0.009) {
      console.error(`[easebuzz] ${source}: ${txnid} paid ${field(r, "amount")} but ${pay.amount} was asked`);
      await c.query(`update shop_payment set status = 'amount_mismatch', raw = $2, updated_at = now() where id = $1`, [pay.id, JSON.stringify(r)]);
      return { error: "Amount mismatch" };
    }
    // a success is final: a later failure for the same attempt never undoes it
    if (pay.status !== "success") {
      await c.query(
        `update shop_payment set status = $2, easepayid = coalesce($3, easepayid), mode = coalesce($4, mode), raw = $5, updated_at = now() where id = $1`,
        [pay.id, status, field(r, "easepayid") || null, field(r, "mode") || null, JSON.stringify(r)],
      );
    }
    if (status !== "success") return { orderId: pay.order_id, placedNow: false };
    // the money is in: paid, and placed if it was waiting (an order cancelled meanwhile stays cancelled, for a refund)
    const o = (await c.query<{ was: string }>(
      `update shop_order o set payment_method = 'online', payment_status = 'paid',
              status = case when o.status = 'awaiting_payment' then 'placed' else o.status end, updated_at = now()
       from (select id, status as was from shop_order where id = $1 for update) w
       where o.id = w.id returning w.was`,
      [pay.order_id],
    )).rows[0];
    return { orderId: pay.order_id, placedNow: o?.was === "awaiting_payment" };
  });
  if ("error" in placed) return { ok: false, error: placed.error! };
  if (placed.placedNow) await notifyOrderStatus(placed.orderId, "placed");
  return { ok: true, status, orderId: placed.orderId };
}

/** Asks Easebuzz how the order's latest attempt went (Transaction API) and records it. */
export async function checkPayment(orderKey: string): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const o = await one<PayOrder>(`${ORDER} where access_key = $1`, [orderKey]);
  if (!o) return { ok: false, status: 404, error: "Order not found." };
  if (o.payment_status === "paid" || !easebuzzReady()) return { ok: true };
  const pay = await one<{ txnid: string; amount: number }>(
    `select txnid, amount::float as amount from shop_payment where order_id = $1 and access_key is not null order by created_at desc limit 1`,
    [o.id],
  );
  if (!pay) return { ok: true };
  const params: Record<string, string> = { key: KEY, txnid: pay.txnid, amount: money(pay.amount), email: EMAIL, phone: o.phone };
  params.hash = sha512([params.key, params.txnid, params.amount, params.email, params.phone, SALT].join("|"));
  try {
    const reply = await post(`${DASH_URL}transaction/v1/retrieve`, params);
    // { status: true, msg: { ...the transaction, signed like the other replies } }; anything else = not known yet
    if (reply.status === true && reply.msg && typeof reply.msg === "object") await applyReply(reply.msg as Record<string, unknown>, "transaction API");
  } catch (e) {
    console.error("[easebuzz] transaction check failed:", e);
  }
  return { ok: true };
}

/** The customer gives up on paying online: the order goes ahead as cash on delivery. */
export async function switchToCash(orderKey: string, customerId: number): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  await checkPayment(orderKey); // a payment that did go through wins
  const r = await one<{ id: number }>(
    `update shop_order set payment_method = 'cod', status = 'placed', updated_at = now()
     where access_key = $1 and customer_id = $2 and status = 'awaiting_payment' and payment_status = 'pending' returning id`,
    [orderKey, customerId],
  );
  if (!r) {
    const o = await one<PayOrder>(`${ORDER} where access_key = $1`, [orderKey]);
    if (!o || o.customer_id !== customerId) return { ok: false, status: 404, error: "Order not found." };
    if (o.payment_status === "paid") return { ok: true }; // already paid online
    return { ok: false, status: 409, error: "This order is not waiting for payment." };
  }
  await notifyOrderStatus(r.id, "placed");
  return { ok: true };
}

/** Online orders left unpaid for 2 hours are cancelled (checked whenever a new order comes in). */
export async function expireUnpaid() {
  await query(
    `update shop_order set status = 'cancelled', updated_at = now()
     where status = 'awaiting_payment' and payment_status = 'pending' and created_at < now() - interval '2 hours'`,
  );
}

/** The payment attempts of an order, newest first (dashboard). */
export const paymentsOf = (orderId: number) =>
  query<{ txnid: string; amount: number; status: string; easepayid: string | null; mode: string | null; created_at: Date; updated_at: Date }>(
    `select txnid, amount::float as amount, status, easepayid, mode, created_at, updated_at from shop_payment where order_id = $1 order by created_at desc`,
    [orderId],
  );
