import { NextResponse, type NextRequest } from "next/server";
import { fail } from "@/lib/shop/api";
import { activity, sfFromRequest } from "@/lib/salesforce";

export const dynamic = "force-dynamic";

/** The officer's recent days: when they started/ended, visits, orders and distance covered. ?days=7 (max 31) */
export async function GET(req: NextRequest) {
  const login = await sfFromRequest(req);
  if (!login) return fail(401, "Please sign in again.");
  return NextResponse.json({ days: await activity(login.staffUid, Number(req.nextUrl.searchParams.get("days")) || 7) });
}
