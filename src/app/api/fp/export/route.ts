import { NextRequest, NextResponse } from "next/server";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { allGridRows } from "@/lib/fp/grid";
import { screenFor } from "@/lib/fp/screens";

export const dynamic = "force-dynamic";

const cell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  const safe = /^[=+@]/.test(s) || (/^-/.test(s) && Number.isNaN(Number(s))) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** GET /api/fp/export?route=activity&f0=...&q=... - the screen's grid, filtered the same way, as CSV. */
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("route") ?? "";
  const user = await userFromToken(req.cookies.get("session")?.value);
  if (!user) return NextResponse.json({ success: false, error: "Sign in first." }, { status: 401 });
  if (!atLeast(levelFor(user, `fp.${key}`), "view")) return NextResponse.json({ success: false, error: "No access." }, { status: 403 });
  const screen = screenFor(key);
  if (!screen?.table) return NextResponse.json({ success: false, error: "Unknown screen." }, { status: 404 });
  const values: Record<string, string> = {};
  for (const f of screen.filters) { const v = req.nextUrl.searchParams.get(f.key); if (v) values[f.key] = v; }
  const rows = await allGridRows(screen, { q: req.nextUrl.searchParams.get("q") ?? "", values });
  const lines = [screen.cols.map((c) => cell(c.label)).join(","), ...rows.map((r) => screen.cols.map((c) => cell(r[c.key])).join(","))];
  return new NextResponse("﻿" + lines.join("\r\n") + "\r\n", {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${key}-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
}
