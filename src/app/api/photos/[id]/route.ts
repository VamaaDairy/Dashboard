import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { userFromToken } from "@/lib/access-server";
import { imageResponse, readPhoto } from "@/lib/photos";

export const dynamic = "force-dynamic";

/** Any app photo, for someone signed in to the Dashboard (customer pages, orders, trips). */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const me = await userFromToken((await cookies()).get("session")?.value);
  if (!me) return new Response("Please sign in.", { status: 401 });
  const p = await readPhoto(Number((await ctx.params).id));
  return p ? imageResponse(p) : new Response("Photo not found.", { status: 404 });
}
