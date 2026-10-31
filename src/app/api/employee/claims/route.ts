import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { empFromRequest, listClaims, submitClaim, withdrawClaim } from "@/lib/employee";

export const dynamic = "force-dynamic";

/** The employee's reimbursement claims. */
export async function GET(req: NextRequest) {
  const e = await empFromRequest(req);
  if (!e) return fail(401, "Please sign in again.");
  return NextResponse.json({ claims: await listClaims(e.staffUid) });
}

/** Submit a claim. Body: { category, amount, spentOn, description, receipt? (data:image/... URL) } */
export async function POST(req: NextRequest) {
  const e = await empFromRequest(req);
  if (!e) return fail(401, "Please sign in again.");
  if (tooMany(req, "emp-claim", 10)) return fail(429, "Too many attempts. Please wait a minute.");
  const b = (await readJson(req, 1_000_000)) as Record<string, unknown> | null;
  if (!b) return fail(400, "Invalid request, or the bill photo is too large.");
  const r = await submitClaim(e.staffUid, b);
  return r.ok ? NextResponse.json({ id: r.id }, { status: 201 }) : fail(400, r.error);
}

/** Withdraw a claim that is still pending. Query: ?id= */
export async function DELETE(req: NextRequest) {
  const e = await empFromRequest(req);
  if (!e) return fail(401, "Please sign in again.");
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id)) return fail(400, "Invalid request.");
  const r = await withdrawClaim(e.staffUid, id);
  return r.ok ? NextResponse.json({ ok: true }) : fail(400, r.error);
}
