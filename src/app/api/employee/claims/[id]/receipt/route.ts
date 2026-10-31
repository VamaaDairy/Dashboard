import { NextResponse, type NextRequest } from "next/server";
import { fail } from "@/lib/shop/api";
import { claimReceipt, empFromRequest } from "@/lib/employee";

export const dynamic = "force-dynamic";

/** The bill photo of one of the employee's own claims, as { receipt: "data:image/..." }. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const e = await empFromRequest(req);
  if (!e) return fail(401, "Please sign in again.");
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return fail(400, "Invalid request.");
  const receipt = await claimReceipt(e.staffUid, id);
  return receipt ? NextResponse.json({ receipt }) : fail(404, "No bill photo.");
}
