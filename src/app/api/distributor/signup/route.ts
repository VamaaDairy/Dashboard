import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { createSelfSignup } from "@/lib/distributor/requests";

export const dynamic = "force-dynamic";

/**
 * Create account, step 2. Body: { kind: "distributor" | "retailer", firmName, ownerName, phone, city, code, pin } and
 * the master details: address, area, state, pincode, gstin, pan, licenceNo (FSSAI), lat, lng, email - all but email
 * required for a distributor, optional for a retailer.
 * Returns { status: "active" } for a retailer (sign in now with the mobile number and this PIN), or
 * { status: "pending" } for a distributor: the office approves it on the Dashboard (App orders > New customers), and
 * only then can it sign in.
 */
export async function POST(req: NextRequest) {
  if (tooMany(req, "dist-signup", 8)) return fail(429, "Too many attempts. Please wait a minute.");
  const b = await readJson(req, 3000);
  if (!b || typeof b !== "object") return fail(400, "Send the details as a JSON object.");
  const r = await createSelfSignup(b as Record<string, unknown>);
  return r.ok ? NextResponse.json({ status: r.status }, { status: 201 }) : fail(r.status, r.error, r.fields);
}
