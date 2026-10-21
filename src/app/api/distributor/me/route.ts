import { NextResponse, type NextRequest } from "next/server";
import { fail } from "@/lib/shop/api";
import { distFromRequest, firmsFor } from "@/lib/distributor";

export const dynamic = "force-dynamic";

/** Who is signed in, and the distributors they can order for (one for a distributor, their mapped ones for a salesman). */
export async function GET(req: NextRequest) {
  const login = await distFromRequest(req);
  if (!login) return fail(401, "Please sign in again.");
  return NextResponse.json({ login: { kind: login.kind, name: login.name, phone: login.phone }, distributors: await firmsFor(login) });
}
