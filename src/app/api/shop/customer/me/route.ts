import { NextResponse, type NextRequest } from "next/server";
import { fail } from "@/lib/shop/api";
import { customerFromRequest, customerJson } from "@/lib/shop/customer";

export const dynamic = "force-dynamic";

/** The signed-in customer's account: name, number and the address they last ordered to. */
export async function GET(req: NextRequest) {
  const c = await customerFromRequest(req);
  if (!c) return fail(401, "Please sign in again.");
  return NextResponse.json({ customer: customerJson(c) });
}
