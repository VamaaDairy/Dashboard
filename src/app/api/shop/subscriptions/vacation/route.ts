import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson } from "@/lib/shop/api";
import { customerFromRequest } from "@/lib/shop/customer";
import { setVacation } from "@/lib/shop/subscriptions";

export const dynamic = "force-dynamic";

/** Vacation: { from, to: YYYY-MM-DD, skip?: boolean (default true) } - no deliveries on those days. */
export async function PUT(req: NextRequest) {
  const c = await customerFromRequest(req);
  if (!c) return fail(401, "Please sign in again.");
  const b = (await readJson(req)) as { from?: unknown; to?: unknown; skip?: unknown } | null;
  const r = await setVacation(c.id, String(b?.from ?? ""), String(b?.to ?? ""), b?.skip !== false);
  return r.ok ? NextResponse.json({ ok: true, days: r.days }) : fail(400, r.error);
}
