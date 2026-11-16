import { NextResponse, type NextRequest } from "next/server";
import { apiError, jsonBody } from "@/lib/api/access";
import { masterAccess } from "@/lib/api/masters";
import { setActive } from "@/lib/masters/entity/service";

export const dynamic = "force-dynamic";

/** Switches a row on or off. Body: { "active": true | false }. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await ctx.params;
  const a = await masterAccess(req, slug, "edit");
  if ("error" in a) return a.error;
  if (!a.def.entity?.active) return apiError(405, `${a.def.title} rows can't be switched on or off.`);
  const body = await jsonBody(req, 1000);
  if (typeof body?.active !== "boolean") return apiError(400, 'Send { "active": true } or { "active": false }.');
  const r = await setActive(a.def, id, body.active, a.caller.who);
  return r.ok ? NextResponse.json({ ok: true }) : apiError(400, r.error);
}
