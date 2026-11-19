import type { NextRequest } from "next/server";
import { fail } from "@/lib/shop/api";
import { distFromRequest } from "@/lib/distributor";
import { imageResponse, readPhoto } from "@/lib/photos";

export const dynamic = "force-dynamic";

/** One of the signed-in firm's own outlet photos. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const login = await distFromRequest(req);
  if (!login?.firmUid) return fail(401, "Please sign in again.");
  const p = await readPhoto(Number((await ctx.params).id), { kind: "outlet", ref: login.firmUid });
  return p ? imageResponse(p) : fail(404, "Photo not found.");
}
