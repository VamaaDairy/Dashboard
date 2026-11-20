import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { liveDispatch } from "@/lib/dispatch/live";
import { todayIst } from "@/lib/orders/direct";

export const dynamic = "force-dynamic";

/**
 * The Live view's data, asked every 15 s: ?date=YYYY-MM-DD (default today). A GET here rather than a server action, so
 * people who can only view App orders can watch it too. The proxy skips /api, so the sign-in and access are checked here.
 */
export async function GET(req: NextRequest) {
  const me = await userFromToken((await cookies()).get("session")?.value);
  if (!me || !atLeast(levelFor(me, "apporders"), "view")) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const d = req.nextUrl.searchParams.get("date") ?? "";
  return NextResponse.json(await liveDispatch(/^\d{4}-\d{2}-\d{2}$/.test(d) ? d : todayIst()));
}
