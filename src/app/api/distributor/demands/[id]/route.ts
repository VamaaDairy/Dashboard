import { NextResponse, type NextRequest } from "next/server";
import { fail } from "@/lib/shop/api";
import { distFromRequest } from "@/lib/distributor";
import { closeDemand } from "@/lib/distributor/demands";

export const dynamic = "force-dynamic";

/** Closes an open requirement: the retailer withdraws its own, or the distributor declines one of its retailers'. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const login = await distFromRequest(req);
  if (!login) return fail(401, "Please sign in again.");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return fail(404, "Requirement not found.");
  const r = await closeDemand(login, id);
  return r.ok ? NextResponse.json({ ok: true }) : fail(400, r.error);
}
