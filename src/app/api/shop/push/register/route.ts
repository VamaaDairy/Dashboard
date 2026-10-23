import { NextResponse, type NextRequest } from "next/server";
import { fail } from "@/lib/shop/api";
import { customerFromRequest } from "@/lib/shop/customer";
import { riderFromRequest } from "@/lib/shop/rider";
import { distFromRequest } from "@/lib/distributor";
import { bearerOf, registerDevice, unregisterDevice, type PushRole } from "@/lib/push";

export const dynamic = "force-dynamic";

/** Which account this Bearer token belongs to: a customer, a rider or a distributor/sales login. */
async function whoIs(req: NextRequest): Promise<{ role: PushRole; id: number; bearer: string } | null> {
  const bearer = bearerOf(req.headers.get("authorization"));
  if (!bearer) return null;
  const c = await customerFromRequest(req);
  if (c) return { role: "customer", id: c.id, bearer };
  const r = await riderFromRequest(req);
  if (r) return { role: "rider", id: r.id, bearer };
  const d = await distFromRequest(req);
  if (d) return { role: "distributor", id: d.id, bearer };
  return null;
}

/** The app hands over this phone's FCM token after sign-in (and whenever Firebase renews it). */
export async function POST(req: NextRequest) {
  const me = await whoIs(req);
  if (!me) return fail(401, "Please sign in again.");
  const body = (await req.json().catch(() => null)) as { token?: unknown; platform?: unknown } | null;
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  if (token.length < 20 || token.length > 4096) return fail(400, "Missing push token.");
  await registerDevice(me.role, me.id, me.bearer, token, body?.platform === "ios" ? "ios" : "android");
  return NextResponse.json({ ok: true });
}

/** Stops pushes to this phone for the signed-in account. */
export async function DELETE(req: NextRequest) {
  const me = await whoIs(req);
  if (!me) return fail(401, "Please sign in again.");
  const body = (await req.json().catch(() => null)) as { token?: unknown } | null;
  if (typeof body?.token === "string") await unregisterDevice(me.role, body.token);
  return NextResponse.json({ ok: true });
}
