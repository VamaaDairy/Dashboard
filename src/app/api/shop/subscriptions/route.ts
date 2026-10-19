import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { customerFromRequest } from "@/lib/shop/customer";
import { createSubscription, customerCalendar, parsePlan, setDay, todayIST, type PlanInput } from "@/lib/shop/subscriptions";

export const dynamic = "force-dynamic";

/** The signed-in customer's subscriptions and calendar. ?from=YYYY-MM-DD (default today) &days=N (default 42, max 120). */
export async function GET(req: NextRequest) {
  const c = await customerFromRequest(req);
  if (!c) return fail(401, "Please sign in again.");
  const sp = req.nextUrl.searchParams;
  const from = /^\d{4}-\d{2}-\d{2}$/.test(sp.get("from") ?? "") ? sp.get("from")! : todayIST();
  const days = Math.min(Math.max(Number(sp.get("days")) || 42, 1), 120);
  return NextResponse.json(await customerCalendar(c.id, from, days));
}

/**
 * Start a subscription. Body: { sku, qty, frequency, weekdays?, everyN?, startDate, endDate?,
 * name, phone, address, pincode?, lat?, lng?, skipDays?: [YYYY-MM-DD] }
 */
export async function POST(req: NextRequest) {
  if (tooMany(req, "subscription", 20)) return fail(429, "Too many requests. Please wait a minute.");
  const c = await customerFromRequest(req);
  if (!c) return fail(401, "Please sign in or create an account to subscribe.");
  const b = (await readJson(req)) as Record<string, unknown> | null;
  if (!b) return fail(400, "Send a JSON body.");
  const p = parsePlan(b);
  if (!p.ok) return fail(400, p.error);

  const name = String(b.name ?? c.name ?? "").trim();
  const phone = String(b.phone ?? c.phone ?? "").replace(/\D/g, "").slice(-10);
  const address = String(b.address ?? c.address ?? "").trim();
  if (name.length < 2) return fail(400, "Enter your name.");
  if (!/^[6-9]\d{9}$/.test(phone)) return fail(400, "Enter a valid 10-digit mobile number.");
  if (address.length < 5) return fail(400, "Add the delivery address for your subscription.");
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

  const r = await createSubscription(c.id, { endDate: null, ...p.plan } as PlanInput, {
    name, phone, address,
    pincode: typeof b.pincode === "string" && b.pincode.trim() ? b.pincode.trim() : c.pincode,
    lat: num(b.lat) ?? c.lat, lng: num(b.lng) ?? c.lng,
  });
  if (!r.ok) return fail(400, r.error);
  // days the customer took out while choosing
  if (Array.isArray(b.skipDays)) for (const d of b.skipDays.slice(0, 120)) if (typeof d === "string") await setDay(c.id, r.id, d, 0);
  return NextResponse.json({ id: r.id }, { status: 201 });
}
