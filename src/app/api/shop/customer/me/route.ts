import { NextResponse, type NextRequest } from "next/server";
import { fail } from "@/lib/shop/api";
import { customerFromRequest, customerJson, parseProfile, updateProfile } from "@/lib/shop/customer";

export const dynamic = "force-dynamic";

/** The signed-in customer's account: name, number and the address they last ordered to. */
export async function GET(req: NextRequest) {
  const c = await customerFromRequest(req);
  if (!c) return fail(401, "Please sign in again.");
  return NextResponse.json({ customer: customerJson(c) });
}

/** Changes the name and/or the saved delivery address. */
export async function PATCH(req: NextRequest) {
  const c = await customerFromRequest(req);
  if (!c) return fail(401, "Please sign in again.");
  const parsed = parseProfile(await req.json().catch(() => null));
  if (!parsed.ok) return fail(400, parsed.error);
  return NextResponse.json({ customer: customerJson(await updateProfile(c.id, parsed.change)) });
}
