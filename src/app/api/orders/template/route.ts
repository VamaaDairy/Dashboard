import { NextRequest, NextResponse } from "next/server";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { templateHeaders, UPLOADS } from "@/lib/orders/upload";

export const dynamic = "force-dynamic";

/** GET /api/orders/template?entity=customer - the header row for a bulk upload. */
export async function GET(req: NextRequest) {
  const user = await userFromToken(req.cookies.get("session")?.value);
  if (!user) return NextResponse.json({ success: false, error: "Sign in first." }, { status: 401 });
  if (!atLeast(levelFor(user, "orders.admin"), "view")) {
    return NextResponse.json({ success: false, error: "No access." }, { status: 403 });
  }
  const entity = req.nextUrl.searchParams.get("entity") ?? "";
  if (!UPLOADS.some((u) => u.key === entity)) return NextResponse.json({ success: false, error: "Unknown template." }, { status: 404 });
  return new NextResponse("﻿" + templateHeaders(entity).join(",") + "\r\n", {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${entity}-template.csv"` },
  });
}
