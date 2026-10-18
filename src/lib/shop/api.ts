import "server-only";
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
    deliveryOtp: o.delivery_otp,
    deliveredAt: o.delivered_at ? new Date(o.delivered_at).toISOString() : null,
    // the rider is only shown to the customer once the order is on its way
    rider: o.rider && o.status === "out_for_delivery"
      ? { name: o.rider.name, phone: o.rider.phone, lat: o.rider.lat, lng: o.rider.lng, locationAt: o.rider.location_at ? new Date(o.rider.location_at).toISOString() : null }
      : o.rider ? { name: o.rider.name, phone: o.rider.phone, lat: null, lng: null, locationAt: null } : null,
    subtotal: o.subtotal,
    deliveryFee: o.delivery_fee,
    total: o.total,
    items: o.items.map((i) => ({
      sku: i.sku_code, name: i.name, image: i.image_url, qty: i.qty, unitPrice: i.unit_price, lineTotal: i.line_total,
    })),
  };
}

export const fail = (status: number, error: string, fields?: Record<string, string>) =>
  NextResponse.json({ error, ...(fields ? { fields } : {}) }, { status });

// These endpoints are public (the app has no login yet), so they defend themselves.

const hits = new Map<string, { n: number; reset: number }>();

/** At most `max` calls per minute from one address. Resets with the process; the order code adds a per-phone limit in the database. */
export function tooMany(req: NextRequest, bucket: string, max: number): boolean {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
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
