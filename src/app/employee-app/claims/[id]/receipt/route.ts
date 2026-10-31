import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { claimReceiptAny } from "@/lib/employee/admin";

export const dynamic = "force-dynamic";

/** The bill photo of a claim, for the office. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await userFromToken((await cookies()).get("session")?.value);
  if (!u || !atLeast(levelFor(u, "emp.claims"), "view")) return new NextResponse("Not allowed", { status: 403 });
  const id = Number((await ctx.params).id);
  const data = Number.isInteger(id) ? await claimReceiptAny(id) : null;
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(data ?? "");
  if (!m) return new NextResponse("No bill photo", { status: 404 });
  return new NextResponse(Buffer.from(m[2], "base64"), { headers: { "content-type": m[1], "cache-control": "private, max-age=300" } });
}
