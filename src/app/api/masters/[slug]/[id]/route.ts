import { NextResponse, type NextRequest } from "next/server";
import { apiError, jsonBody } from "@/lib/api/access";
import { asForm, masterAccess } from "@/lib/api/masters";
import { loadRecord, removeRecord, saveRecord } from "@/lib/masters/entity/service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string; id: string }> };

/** One row of an editable master, as its Dashboard form shows it. */
export async function GET(req: NextRequest, ctx: Ctx) {
  const { slug, id } = await ctx.params;
  const a = await masterAccess(req, slug, "view");
  if ("error" in a) return a.error;
  if (!a.def.entity) return apiError(404, `${a.def.title} rows can't be opened one by one; use GET /api/masters/${slug}.`);
  const row = await loadRecord(a.def, id);
  return row ? NextResponse.json({ id, record: row }) : apiError(404, `No ${a.def.entity.noun} with id ${id}.`);
}

/**
 * Changes a row. Body: only the fields to change ({ field: value }); the others stay as they are. The same checks
 * and change log as the Dashboard form.
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { slug, id } = await ctx.params;
  const a = await masterAccess(req, slug, "edit");
  if ("error" in a) return a.error;
  const body = await jsonBody(req);
  if (!body || !Object.keys(body).length) return apiError(400, "Send the fields to change as a JSON object.");
  const r = await saveRecord(a.def, id, asForm(body), a.caller.who, { only: Object.keys(body) });
  return r.ok ? NextResponse.json({ id: r.id }) : apiError(r.error.includes("no longer exists") ? 404 : 400, r.error, { fieldErrors: r.fieldErrors });
}

/** Deletes a row; refused while other records still use it (switch it off instead: POST .../active). */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { slug, id } = await ctx.params;
  const a = await masterAccess(req, slug, "edit");
  if ("error" in a) return a.error;
  const r = await removeRecord(a.def, id, a.caller.who);
  return r.ok ? NextResponse.json({ ok: true }) : apiError(409, r.error);
}
