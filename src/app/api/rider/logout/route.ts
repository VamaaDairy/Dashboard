import { NextResponse, type NextRequest } from "next/server";
import { endRiderSession } from "@/lib/shop/rider";

export const dynamic = "force-dynamic";

/** Sign out on this phone only (Authorization: Bearer <token>); the partner's other phones stay signed in. Always succeeds. */
export async function POST(req: NextRequest) {
  await endRiderSession(req);
  return NextResponse.json({ ok: true });
}
