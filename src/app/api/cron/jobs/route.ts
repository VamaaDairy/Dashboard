import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { fail } from "@/lib/shop/api";
import { runJobs } from "@/lib/jobs";

export const dynamic = "force-dynamic";

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Runs the background jobs once (subscription orders, UPI Autopay - src/lib/jobs.ts) for an outside scheduler, e.g.
 * Windows Task Scheduler every 10 minutes:
 *   curl -s -X POST -H "Authorization: Bearer %CRON_KEY%" https://<host>/api/cron/jobs
 * Needs CRON_KEY in .env (SUBSCRIPTION_CRON_KEY also works). Safe to call as often as you like: a run already going
 * elsewhere makes this one return { ran: false, skipped: "busy" }.
 */
export async function POST(req: NextRequest) {
  const want = process.env.CRON_KEY || process.env.SUBSCRIPTION_CRON_KEY;
  const got = /^Bearer (.+)$/.exec(req.headers.get("authorization") ?? "")?.[1] ?? "";
  if (!want || !same(got, want)) return fail(401, "Not allowed.");
  const r = await runJobs();
  return NextResponse.json(r, { status: r.errors.length ? 500 : 200 });
}
