import { NextResponse, type NextRequest } from "next/server";
import { one } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * The exact bytes of a record anchored on Stellar. Public: anyone (the trace page, an auditor)
 * re-hashes them and compares with the chain. A record never changes, so it is cached for good.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ hash: string }> }) {
  const hash = (await ctx.params).hash.toLowerCase().replace(/\.json$/, "");
  if (!/^[0-9a-f]{64}$/.test(hash)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const row = await one<{ body: Buffer }>(`select body from trace_record where hash = $1`, [hash]);
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return new NextResponse(new Uint8Array(row.body), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
