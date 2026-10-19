import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson } from "@/lib/shop/api";
import { customerFromRequest } from "@/lib/shop/customer";
import { setDay } from "@/lib/shop/subscriptions";

export const dynamic = "force-dynamic";

/** One day of one subscription: { day: YYYY-MM-DD, qty } - qty 0 skips it, null goes back to the plan. */
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const c = await customerFromRequest(req);
  if (!c) return fail(401, "Please sign in again.");
  const id = Number((await ctx.params).id);
  const b = (await readJson(req)) as { day?: unknown; qty?: unknown } | null;
  const r = await setDay(c.id, id, String(b?.day ?? ""), b?.qty === null || b?.qty === undefined ? null : Number(b.qty));
  return r.ok ? NextResponse.json({ ok: true }) : fail(400, r.error);
}
