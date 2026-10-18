import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { verifySession } from "@/lib/auth";
import { AUTH_DISABLED } from "@/lib/access-server";

/** The proxy lets every /api/ path through, so dashboard endpoints check the session themselves. */
export async function requireSession(req: NextRequest) {
  if (AUTH_DISABLED) return null;
  const token = req.cookies.get("session")?.value;
  const session = token ? await verifySession(token) : null;
  return session ? null : NextResponse.json({ error: "Not signed in" }, { status: 401 });
}
