import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { customerFromRequest } from "@/lib/shop/customer";
import { autopayView, MAX_DEBIT } from "@/lib/shop/autopay";
import { nextPack, packState, parsePeriod, periodLabel, setPeriod } from "@/lib/shop/packs";
import { rupees } from "@/lib/shop/pricing";

export const dynamic = "force-dynamic";

/**
 * How long each subscription payment covers, from the next one on. Body: { unit: "weeks" | "month" | "days", len }.
 * A payment already with the bank is not changed. Returns the autopay view.
 */
export async function PUT(req: NextRequest) {
  if (tooMany(req, "autopay-period", 10)) return fail(429, "Too many attempts. Please wait a minute.");
  const c = await customerFromRequest(req);
  if (!c) return fail(401, "Please sign in again.");
  const p = parsePeriod(await readJson(req, 500));
  if (!p) return fail(400, "Choose how long to pay for: 4 weeks, a month, or a date up to a year ahead.");
  const quote = await nextPack(c.id, [], await packState(c.id), p);
  if (quote && quote.amount > MAX_DEBIT) {
    return fail(400, `${periodLabel(p)} of deliveries cost ${rupees(quote.amount)}; one payment can be at most ${rupees(MAX_DEBIT)}.`);
  }
  await setPeriod(c.id, p);
  return NextResponse.json(await autopayView(c.id));
}
