import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { ordersPulse } from "@/lib/orders/primary";

export const dynamic = "force-dynamic";

/** A fingerprint of the primary orders, for the order list to know when to reload itself. */
export async function GET() {
  const me = await userFromToken((await cookies()).get("session")?.value);
  if (!me || !atLeast(levelFor(me, "fp.portalOrder"), "view")) return new NextResponse(null, { status: 401 });
  return NextResponse.json({ p: await ordersPulse() }, { headers: { "Cache-Control": "no-store" } });
}
