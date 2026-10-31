import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson } from "@/lib/shop/api";
import { dayStatus, endDay, sfFromRequest, startDay } from "@/lib/salesforce";

export const dynamic = "force-dynamic";

/** Today's working day: started/ended, the store they are checked in at (if any) and the day's counts. */
export async function GET(req: NextRequest) {
  const login = await sfFromRequest(req);
  if (!login) return fail(401, "Please sign in again.");
  return NextResponse.json(await dayStatus(login.staffUid));
}

/** Start or end the day. Body: { action: "start" | "end", lat, lng } - the phone's location at that moment. */
export async function POST(req: NextRequest) {
  const login = await sfFromRequest(req);
  if (!login) return fail(401, "Please sign in again.");
  const b = (await readJson(req, 2000)) as { action?: unknown; lat?: unknown; lng?: unknown } | null;
  if (b?.action !== "start" && b?.action !== "end") return fail(400, "Invalid request.");
  const r = b.action === "start" ? await startDay(login.staffUid, b.lat, b.lng) : await endDay(login.staffUid, b.lat, b.lng);
  if (!r.ok) return fail(400, r.error);
  return NextResponse.json(await dayStatus(login.staffUid));
}
