import { NextResponse, type NextRequest } from "next/server";
import { fail } from "@/lib/shop/api";
import { routePlan, sfFromRequest } from "@/lib/salesforce";

export const dynamic = "force-dynamic";

/** The officer's fixed route: their beats (today's flagged) with the stores on each and today's visit status. */
export async function GET(req: NextRequest) {
  const login = await sfFromRequest(req);
  if (!login) return fail(401, "Please sign in again.");
  return NextResponse.json(await routePlan(login.staffUid));
}
