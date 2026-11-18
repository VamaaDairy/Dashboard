import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { userFromToken } from "@/lib/access-server";
import { levelFor } from "@/lib/access";
import { one } from "@/lib/db";

export const dynamic = "force-dynamic";

/** A photo sent with an app complaint, for the dashboard (anyone who can open CN Management). */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const me = await userFromToken((await cookies()).get("session")?.value);
  if (!me || levelFor(me, "cn") === "none") return new NextResponse(null, { status: 401 });
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) return new NextResponse(null, { status: 404 });
  const p = await one<{ mime: string; data: Buffer }>(`select mime, data from cn_photo where id = $1`, [Number(id)]);
  if (!p) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(p.data), { headers: { "content-type": p.mime, "cache-control": "private, max-age=3600" } });
}
