import { NextResponse, type NextRequest } from "next/server";
import { fail } from "@/lib/shop/api";
import { empFromRequest, listPayslips } from "@/lib/employee";

export const dynamic = "force-dynamic";

/** The employee's published salary slips, newest month first. */
export async function GET(req: NextRequest) {
  const e = await empFromRequest(req);
  if (!e) return fail(401, "Please sign in again.");
  return NextResponse.json({ payslips: await listPayslips(e.staffUid) });
}
