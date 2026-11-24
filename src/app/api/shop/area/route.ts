import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { deliveryArea } from "@/lib/shop/area";

export const dynamic = "force-dynamic";

/**
 * Before checkout the app asks whether an address can get deliveries. Body: { lat?, lng?, pincode? }.
 * Returns { ok: true } or { ok: false, message } - browsing stays open either way.
 */
export async function POST(req: NextRequest) {
  if (tooMany(req, "area", 30)) return fail(429, "Too many requests. Please wait a minute.");
  const b = (await readJson(req)) as Record<string, unknown> | null;
  if (!b) return fail(400, "Send a JSON body.");
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const r = await deliveryArea({ lat: num(b.lat), lng: num(b.lng), pincode: typeof b.pincode === "string" ? b.pincode : null });
  return NextResponse.json(r.ok ? { ok: true } : { ok: false, message: r.message });
}
