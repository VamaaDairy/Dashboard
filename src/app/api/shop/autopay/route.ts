import { NextResponse, type NextRequest } from "next/server";
import { fail, tooMany } from "@/lib/shop/api";
import { customerFromRequest } from "@/lib/shop/customer";
import { autopayView, startMandate } from "@/lib/shop/autopay";

export const dynamic = "force-dynamic";

/** The signed-in customer's autopay: state, subscription packs, recent payments. */
export async function GET(req: NextRequest) {
  const c = await customerFromRequest(req);
  if (!c) return fail(401, "Please sign in again.");
  return NextResponse.json(await autopayView(c.id));
}

/**
 * Pay for the subscription with UPI Autopay: returns { url, amount, days } - the page the app opens (the customer's
 * UPI app), where they approve autopay and pay the first period in one step.
 */
export async function POST(req: NextRequest) {
  if (tooMany(req, "autopay", 6)) return fail(429, "Too many attempts. Please wait a minute.");
  const c = await customerFromRequest(req);
  if (!c) return fail(401, "Please sign in again.");
  const r = await startMandate(c);
  if (!r.ok) return fail(r.status, r.error);
  return NextResponse.json({ url: r.url, amount: r.amount, days: r.days }, { status: 201 });
}
