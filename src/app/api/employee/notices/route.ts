import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson } from "@/lib/shop/api";
import { empFromRequest, listNotices, markAllNoticesRead, markNoticeRead } from "@/lib/employee";

export const dynamic = "force-dynamic";

/** Everything the office sent this employee, newest first, with the unread count. */
export async function GET(req: NextRequest) {
  const e = await empFromRequest(req);
  if (!e) return fail(401, "Please sign in again.");
  return NextResponse.json(await listNotices(e));
}

/** Mark read. Body: { id } for one notice, or { all: true }. */
export async function POST(req: NextRequest) {
  const e = await empFromRequest(req);
  if (!e) return fail(401, "Please sign in again.");
  const b = (await readJson(req, 500)) as { id?: unknown; all?: unknown } | null;
  if (b?.all === true) await markAllNoticesRead(e);
  else if (Number.isInteger(b?.id)) await markNoticeRead(e, b!.id as number);
  else return fail(400, "Invalid request.");
  return NextResponse.json({ ok: true });
}
