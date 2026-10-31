import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson } from "@/lib/shop/api";
import { empFromRequest, getPhoto, getProfile, homeSummary, saveProfile, signOutEmployee } from "@/lib/employee";

export const dynamic = "force-dynamic";

/** The signed-in employee: profile, photo and the home summary (today's punch, month so far, leave left, unread notices ...). */
export async function GET(req: NextRequest) {
  const e = await empFromRequest(req);
  if (!e) return fail(401, "Please sign in again.");
  const [profile, summary, photo] = await Promise.all([getProfile(e), homeSummary(e), getPhoto(e.staffUid)]);
  return NextResponse.json({ profile, summary, photo });
}

/** Saves the parts of the profile an employee keeps themselves (emergency contact, bank details, photo). */
export async function PUT(req: NextRequest) {
  const e = await empFromRequest(req);
  if (!e) return fail(401, "Please sign in again.");
  const b = (await readJson(req, 400_000)) as Record<string, unknown> | null;
  if (!b) return fail(400, "Invalid request.");
  const r = await saveProfile(e.staffUid, b);
  return r.ok ? NextResponse.json({ saved: true }) : fail(400, r.error);
}

/** Signs this phone out. */
export async function DELETE(req: NextRequest) {
  const e = await empFromRequest(req);
  if (!e) return NextResponse.json({ ok: true });
  await signOutEmployee(e.loginId);
  return NextResponse.json({ ok: true });
}
