import { NextResponse, type NextRequest } from "next/server";
import { endSession } from "@/lib/shop/customer";

export const dynamic = "force-dynamic";

/** Sign out on this phone only (Authorization: Bearer <token>). Always succeeds. */
export async function POST(req: NextRequest) {
  await endSession(req);
  return NextResponse.json({ ok: true });
}
