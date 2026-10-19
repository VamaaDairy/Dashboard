import { NextResponse, type NextRequest } from "next/server";
import { fail } from "@/lib/shop/api";
import { addDays, generateOrders, todayIST } from "@/lib/shop/subscriptions";

export const dynamic = "force-dynamic";

/**
 * Creates tomorrow's subscription orders. Call it every evening after 9 PM (India), e.g. from the
 * server's crontab:  5 21 * * *  curl -s "https://<host>/api/cron/subscriptions?key=$SUBSCRIPTION_CRON_KEY"
 * Needs SUBSCRIPTION_CRON_KEY set on the server. Safe to call more than once. ?day=YYYY-MM-DD for another day.
 */
export async function GET(req: NextRequest) {
  const want = process.env.SUBSCRIPTION_CRON_KEY;
  if (!want || req.nextUrl.searchParams.get("key") !== want) return fail(401, "Not allowed.");
  const d = req.nextUrl.searchParams.get("day");
  const day = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : addDays(todayIST(), 1);
  return NextResponse.json({ day, ...(await generateOrders(day)) });
}
