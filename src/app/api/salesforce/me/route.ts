import { NextResponse, type NextRequest } from "next/server";
import { fail } from "@/lib/shop/api";
import { firmsFor } from "@/lib/distributor";
import { sfFromRequest } from "@/lib/salesforce";

export const dynamic = "force-dynamic";

/** Who is signed in and the distributors they can book orders for. */
export async function GET(req: NextRequest) {
  const login = await sfFromRequest(req);
  if (!login) return fail(401, "Please sign in again.");
  return NextResponse.json({ login: { kind: login.kind, name: login.name, phone: login.phone }, distributors: await firmsFor(login) });
}
