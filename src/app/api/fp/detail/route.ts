import { NextRequest, NextResponse } from "next/server";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { DETAILS } from "@/lib/fp/rowActions";

export const dynamic = "force-dynamic";

/** GET /api/fp/detail?route=fpsalesview&id=<uuid> - the popup behind a grid row's "View". */
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("route") ?? "";
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const user = await userFromToken(req.cookies.get("session")?.value);
  if (!user) return NextResponse.json({ success: false, error: "Sign in first." }, { status: 401 });
  if (!atLeast(levelFor(user, `fp.${key}`), "view")) return NextResponse.json({ success: false, error: "No access." }, { status: 403 });
  const load = DETAILS[key];
  if (!load || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ success: false, error: "Nothing to show." }, { status: 404 });
  try {
    return NextResponse.json({ success: true, detail: await load(id) });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Could not load" }, { status: 404 });
  }
}
