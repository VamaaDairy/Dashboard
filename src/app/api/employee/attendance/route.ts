import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { attendanceMonth, empFromRequest, punchIn, punchOut, todayAttendance } from "@/lib/employee";

export const dynamic = "force-dynamic";

/** Today's punch, and the month's attendance. Query: ?month=YYYY-MM (default this month). */
export async function GET(req: NextRequest) {
  const e = await empFromRequest(req);
  if (!e) return fail(401, "Please sign in again.");
  const month = req.nextUrl.searchParams.get("month") ?? "";
  const [today, m] = await Promise.all([todayAttendance(e.staffUid), attendanceMonth(e.staffUid, month)]);
  return NextResponse.json({ today, ...m });
}

/** Punch in or out. Body: { action: "in" | "out", lat, lng, accuracy?, method?: "biometric" | "app" } */
export async function POST(req: NextRequest) {
  const e = await empFromRequest(req);
  if (!e) return fail(401, "Please sign in again.");
  if (tooMany(req, "emp-punch", 20)) return fail(429, "Too many attempts. Please wait a minute.");
  const b = (await readJson(req, 2000)) as { action?: unknown; lat?: unknown; lng?: unknown; accuracy?: unknown; method?: unknown } | null;
  if (b?.action !== "in" && b?.action !== "out") return fail(400, "Invalid request.");
  const r = b.action === "in" ? await punchIn(e, b) : await punchOut(e, b);
  return r.ok ? NextResponse.json({ today: r.today }) : fail(400, r.error);
}
