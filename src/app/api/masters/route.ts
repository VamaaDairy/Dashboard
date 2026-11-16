import { NextResponse, type NextRequest } from "next/server";
import { apiCaller, can, unauthorised } from "@/lib/api/access";
import { describe, mastersFor } from "@/lib/api/masters";

export const dynamic = "force-dynamic";

/**
 * Every master the caller may open (Dashboard sign-in or API key), with its columns, filters and - for the ones they
 * may edit - the fields a create / update takes. Each one is then at /api/masters/{slug} and /api/masters/{slug}/{id}.
 */
export async function GET(req: NextRequest) {
  const caller = await apiCaller(req);
  if (!caller) return unauthorised();
  return NextResponse.json({ masters: mastersFor(caller).map((d) => describe(d, can(caller, `fp.${d.slug}`, "edit"))) });
}
