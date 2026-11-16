import { NextResponse, type NextRequest } from "next/server";
import { apiError, jsonBody } from "@/lib/api/access";
import { asForm, describe, masterAccess } from "@/lib/api/masters";
import { listMaster } from "@/lib/masters/repository";
import { readRequest } from "@/lib/masters/request";
import { saveRecord } from "@/lib/masters/entity/service";
import { PAGE_SIZE } from "@/lib/masters/constants";
import type { SearchParams } from "@/lib/masters/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

/**
 * One master's rows, as on its Dashboard screen: ?q= search, ?page= (50 a page), ?f_<filter>= filters, and ?from= /
 * ?to= (YYYY-MM-DD) on reports. Each row carries `_id` (open it at /api/masters/{slug}/{_id}) when it has one.
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  const a = await masterAccess(req, (await ctx.params).slug, "view");
  if ("error" in a) return a.error;
  const params: SearchParams = Object.fromEntries(req.nextUrl.searchParams.entries());
  const r = readRequest(a.def, params);
  const list = await listMaster(a.def, r);
  return NextResponse.json({
    master: describe(a.def, false).title,
    page: r.page,
    pageSize: PAGE_SIZE,
    pages: list.pages,
    total: list.total,
    stats: list.stats,
    rows: list.rows,
  });
}

/** Adds a row. Body: { field: value, ... } - the field names GET /api/masters lists for this master. */
export async function POST(req: NextRequest, ctx: Ctx) {
  const a = await masterAccess(req, (await ctx.params).slug, "edit");
  if ("error" in a) return a.error;
  const body = await jsonBody(req);
  if (!body) return apiError(400, "Send the new row as a JSON object.");
  const r = await saveRecord(a.def, null, asForm(body), a.caller.who);
  return r.ok ? NextResponse.json({ id: r.id }, { status: 201 }) : apiError(400, r.error, { fieldErrors: r.fieldErrors });
}
