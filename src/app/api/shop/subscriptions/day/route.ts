import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson } from "@/lib/shop/api";
import { customerFromRequest } from "@/lib/shop/customer";
import { setWholeDay } from "@/lib/shop/subscriptions";

export const dynamic = "force-dynamic";

/** Skip a whole day (every subscription) or bring it back: { day: YYYY-MM-DD, skip: boolean }. */
export async function PUT(req: NextRequest) {
  const c = await customerFromRequest(req);
  if (!c) return fail(401, "Please sign in again.");
  const b = (await readJson(req)) as { day?: unknown; skip?: unknown } | null;
  const r = await setWholeDay(c.id, String(b?.day ?? ""), b?.skip === true);
  return r.ok ? NextResponse.json({ ok: true }) : fail(400, r.error);
}
