import { NextResponse, type NextRequest } from "next/server";
import { endDistSession } from "@/lib/distributor";

export const dynamic = "force-dynamic";

/** Sign out on this phone only (Authorization: Bearer <token>); the login's other phones stay signed in. Always succeeds. */
export async function POST(req: NextRequest) {
  await endDistSession(req);
  return NextResponse.json({ ok: true });
}
