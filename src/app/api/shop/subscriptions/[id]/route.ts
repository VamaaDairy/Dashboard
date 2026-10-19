import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson } from "@/lib/shop/api";
import { customerFromRequest } from "@/lib/shop/customer";
import { parsePlan, updateSubscription } from "@/lib/shop/subscriptions";

export const dynamic = "force-dynamic";

/** Change a subscription: { qty?, frequency?, weekdays?, everyN?, endDate?, status?: active | paused | cancelled }. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const c = await customerFromRequest(req);
  if (!c) return fail(401, "Please sign in again.");
  const id = Number((await ctx.params).id);
  const b = (await readJson(req)) as Record<string, unknown> | null;
  if (!b || !Number.isInteger(id)) return fail(400, "Nothing to change.");
  const { sku: _s, startDate: _d, ...rest } = b; // product and start stay as they are
  const p = parsePlan(rest, true);
  if (!p.ok) return fail(400, p.error);
  const status = b.status;
  if (status !== undefined && status !== "active" && status !== "paused" && status !== "cancelled") return fail(400, "Unknown status.");
  const ok = await updateSubscription(c.id, id, { ...p.plan, ...(status ? { status } : {}) });
  return ok ? NextResponse.json({ ok: true }) : fail(404, "That subscription no longer exists.");
}
