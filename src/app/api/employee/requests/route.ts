import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { empFromRequest, listRequests, sendRequest } from "@/lib/employee";

export const dynamic = "force-dynamic";

/** The employee's requests to the office and the replies. */
export async function GET(req: NextRequest) {
  const e = await empFromRequest(req);
  if (!e) return fail(401, "Please sign in again.");
  return NextResponse.json({ requests: await listRequests(e.staffUid) });
}

/** Send a request. Body: { kind, subject, message } */
export async function POST(req: NextRequest) {
  const e = await empFromRequest(req);
  if (!e) return fail(401, "Please sign in again.");
  if (tooMany(req, "emp-request", 10)) return fail(429, "Too many attempts. Please wait a minute.");
  const b = (await readJson(req, 4000)) as Record<string, unknown> | null;
  if (!b) return fail(400, "Invalid request.");
  const r = await sendRequest(e.staffUid, b);
  return r.ok ? NextResponse.json({ id: r.id }, { status: 201 }) : fail(400, r.error);
}
