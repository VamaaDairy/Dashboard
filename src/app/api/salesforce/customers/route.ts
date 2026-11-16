import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { sfFromRequest } from "@/lib/salesforce";
import { createFirmRequest, myFirmRequests, REQUEST_KINDS } from "@/lib/distributor/requests";

export const dynamic = "force-dynamic";

/** The new customers this officer proposed, with their status (pending / approved with its code / rejected with why). */
export async function GET(req: NextRequest) {
  const login = await sfFromRequest(req);
  if (!login) return fail(401, "Please sign in again.");
  return NextResponse.json({ kinds: REQUEST_KINDS, requests: await myFirmRequests(login.staffUid) });
}

/**
 * Propose a new customer. Body: { name, kind (Distributor | Super Stockist | Retailer | MFS | Institution), contactPerson?,
 * phone, email?, address, city?, pincode?, state?, lat?, lng?, gstin?, notes? }. It waits for the office's approval on the
 * Dashboard; once approved it is mapped to this officer and orders can be booked for it.
 */
export async function POST(req: NextRequest) {
  const login = await sfFromRequest(req);
  if (!login) return fail(401, "Please sign in again.");
  if (tooMany(req, "sf-customer", 10)) return fail(429, "Too many requests. Please wait a minute.");
  const b = await readJson(req, 5000);
  if (!b || typeof b !== "object") return fail(400, "Send the details as a JSON object.");
  const r = await createFirmRequest(login.staffUid, login.id || null, b as Record<string, unknown>);
  return r.ok ? NextResponse.json(r.request, { status: 201 }) : fail(400, r.error, r.fields);
}
