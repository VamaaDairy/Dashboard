import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { applyLeave, cancelLeave, empFromRequest, leaveBalances, listLeaves } from "@/lib/employee";

export const dynamic = "force-dynamic";

/** Leave balances (by type, this year) and the employee's leave requests. */
export async function GET(req: NextRequest) {
  const e = await empFromRequest(req);
  if (!e) return fail(401, "Please sign in again.");
  const [balances, leaves] = await Promise.all([leaveBalances(e.staffUid), listLeaves(e.staffUid)]);
  return NextResponse.json({ balances, leaves });
}

/** Apply for leave. Body: { typeId, from, to, halfDay?, reason } */
export async function POST(req: NextRequest) {
  const e = await empFromRequest(req);
  if (!e) return fail(401, "Please sign in again.");
  if (tooMany(req, "emp-leave", 10)) return fail(429, "Too many attempts. Please wait a minute.");
  const b = (await readJson(req, 3000)) as Record<string, unknown> | null;
  if (!b) return fail(400, "Invalid request.");
  const r = await applyLeave(e.staffUid, b);
  return r.ok ? NextResponse.json({ id: r.id }, { status: 201 }) : fail(400, r.error);
}

/** Cancel a leave request. Query: ?id= */
export async function DELETE(req: NextRequest) {
  const e = await empFromRequest(req);
  if (!e) return fail(401, "Please sign in again.");
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id)) return fail(400, "Invalid request.");
  const r = await cancelLeave(e.staffUid, id);
  return r.ok ? NextResponse.json({ ok: true }) : fail(400, r.error);
}
