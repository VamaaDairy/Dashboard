import "server-only";
import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import type { ShopOrder } from "./orders";
import { STATUS_LABEL } from "./pricing";

/** The order as the app sees it. */
export function orderJson(o: ShopOrder) {
  return {
    orderNo: o.order_no,
    accessKey: o.access_key,
    status: o.status,
    statusLabel: STATUS_LABEL[o.status] ?? o.status,
    paymentMethod: o.payment_method,
    paymentStatus: o.payment_status,
    createdAt: new Date(o.created_at).toISOString(),
    name: o.name,
    phone: o.phone,
    address: o.address,
    pincode: o.pincode,
    notes: o.notes,
    lat: o.lat,
    lng: o.lng,
    // subscription orders are handed over without a code; only one-time (cart) orders have one
    deliveryOtp: o.subscription_day ? null : o.delivery_otp,
    otpRequired: !o.subscription_day,
    deliveredAt: o.delivered_at ? new Date(o.delivered_at).toISOString() : null,
    riderRating: o.rider_rating ?? null,
    riderRatingNote: o.rider_rating_note ?? null,
    // the rider is only shown to the customer once the order is on its way
    rider: o.rider && o.status === "out_for_delivery"
      ? { name: o.rider.name, phone: o.rider.phone, lat: o.rider.lat, lng: o.rider.lng, locationAt: o.rider.location_at ? new Date(o.rider.location_at).toISOString() : null }
      : o.rider ? { name: o.rider.name, phone: o.rider.phone, lat: null, lng: null, locationAt: null } : null,
    subtotal: o.subtotal,
    discount: Number(o.discount ?? 0),
    couponCode: o.coupon_code ?? null,
    offers: (o.offers ?? []).map((x) => ({ title: x.title, discount: Number(x.discount), freeUnits: x.free_units })),
    deliveryFee: o.delivery_fee,
    total: o.total,
    items: o.items.map((i) => ({
      sku: i.sku_code, name: i.name, image: i.image_url, qty: i.qty, unitPrice: i.unit_price, lineTotal: i.line_total,
      discount: Number(i.discount ?? 0), free: !!i.free,
    })),
  };
}

export const fail = (status: number, error: string, fields?: Record<string, string>) =>
  NextResponse.json({ error, ...(fields ? { fields } : {}) }, { status });

// These endpoints are public (the app has no login yet), so they defend themselves.

/**
 * The caller's address. IIS (ARR) in front of the app appends the address it saw as the LAST
 * X-Forwarded-For entry (with a port), so only that one is trusted: anything before it was sent
 * by the client and can be made up. The port is dropped so every connection from one address counts together.
 */
export function clientIp(req: NextRequest): string {
  const last = (req.headers.get("x-forwarded-for") ?? "").split(",").pop()?.trim() ?? "";
  const ip = last.startsWith("[") ? last.slice(1, last.indexOf("]")) : /^[\d.]+:\d+$/.test(last) ? last.split(":")[0] : last;
  return ip || "unknown";
}

const hits = new Map<string, { n: number; reset: number }>();

/** At most `max` calls per minute from one address. Resets with the process; the order code adds a per-phone limit in the database. */
export function tooMany(req: NextRequest, bucket: string, max: number): boolean {
  const ip = clientIp(req);
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const h = hits.get(key);
  if (!h || h.reset < now) {
    hits.set(key, { n: 1, reset: now + 60_000 });
    if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    return false;
  }
  return ++h.n > max;
}

/** The JSON body, or null if it is missing, malformed or larger than `maxBytes`. */
export async function readJson(req: NextRequest, maxBytes = 20_000): Promise<unknown | null> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) return null;
  try {
    const text = await req.text();
    if (text.length > maxBytes) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * JSON with an ETag: when the app already has exactly this (If-None-Match), answer 304 with no
 * body - the phone keeps what it has and nothing is downloaded again.
 */
export function jsonWithEtag(req: NextRequest, body: unknown, maxAge = 60, scope: "public" | "private" = "public"): NextResponse {
  const text = JSON.stringify(body);
  const etag = `"${createHash("sha1").update(text).digest("base64url")}"`;
  const headers = { ETag: etag, "Cache-Control": `${scope}, max-age=${maxAge}` };
  if (req.headers.get("if-none-match") === etag) return new NextResponse(null, { status: 304, headers });
  return new NextResponse(text, { headers: { ...headers, "Content-Type": "application/json" } });
}
