import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { createSelfSignup } from "@/lib/distributor/requests";

export const dynamic = "force-dynamic";

/**
 * Create account / onboarding, last step. Body: { kind: "distributor" | "retailer", firmName, ownerName, phone, city,
 * code, pin } and the customer master's details: email, landline, address, area, district, state, pincode, lat, lng,
 * gstin, pan, licenceNo (FSSAI), aadharNo - a distributor gives them all (landline and Aadhaar optional).
 * Returns { status, ticket }: "active" for a retailer (sign in now with the mobile number and this PIN), "pending" for a
 * distributor, which the office approves on the Dashboard (New customers) - the app follows it with the ticket
 * (POST /api/distributor/signup/status) and the distributor signs in with this PIN once approved.
 */
export async function POST(req: NextRequest) {
  if (tooMany(req, "dist-signup", 8)) return fail(429, "Too many attempts. Please wait a minute.");
  const b = await readJson(req, 3000);
  if (!b || typeof b !== "object") return fail(400, "Send the details as a JSON object.");
  const r = await createSelfSignup(b as Record<string, unknown>);
  return r.ok ? NextResponse.json({ status: r.status, ticket: r.ticket }, { status: 201 }) : fail(r.status, r.error, r.fields);
}
