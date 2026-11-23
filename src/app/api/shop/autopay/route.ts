import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { customerFromRequest } from "@/lib/shop/customer";
import { autopayView, startMandate } from "@/lib/shop/autopay";

export const dynamic = "force-dynamic";

/** The signed-in customer's autopay (UPI or eNACH): state, limit, subscription packs, recent charges. */
export async function GET(req: NextRequest) {
  const c = await customerFromRequest(req);
  if (!c) return fail(401, "Please sign in again.");
  return NextResponse.json(await autopayView(c.id));
}

/** Set up autopay. Body: { maxAmount?: rupees per debit - one 30-delivery pack (500-15000, default 5000) }. Returns { url } for the app to open. */
export async function POST(req: NextRequest) {
  if (tooMany(req, "autopay", 6)) return fail(429, "Too many attempts. Please wait a minute.");
  const c = await customerFromRequest(req);
  if (!c) return fail(401, "Please sign in again.");
  const b = ((await readJson(req, 2000)) ?? {}) as { maxAmount?: unknown };
  const r = await startMandate(c, typeof b.maxAmount === "number" ? b.maxAmount : undefined);
  if (!r.ok) return fail(r.status, r.error);
  return NextResponse.json({ url: r.url }, { status: 201 });
}
