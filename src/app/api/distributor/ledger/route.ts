import { NextResponse, type NextRequest } from "next/server";
import { one } from "@/lib/db";
import { fail, tooMany } from "@/lib/shop/api";
import { distFromRequest, firmsFor } from "@/lib/distributor";
import { distLedger } from "@/lib/distributor/ledger";

export const dynamic = "force-dynamic";

/**
 * The signed-in distributor's account in Tally: ?months=1|3|6|12 (default 3), and for a sales officer ?firmUid= one
 * of their distributors. Returns { ledger } - opening, every bill / receipt / credit note with the running balance,
 * what is owed now, when it was read and whether it is the last copy (Tally not reachable).
 */
export async function GET(req: NextRequest) {
  const login = await distFromRequest(req);
  if (!login) return fail(401, "Please sign in again.");
  if (login.kind === "retailer") return fail(403, "Your account is with your distributor.");
  if (tooMany(req, "dist-ledger", 30)) return fail(429, "Too many requests. Please wait a minute.");
  const sp = req.nextUrl.searchParams;
  const firms = await firmsFor(login);
  const firm = firms.find((f) => f.uid === (sp.get("firmUid") ?? login.firmUid)) ?? (login.kind === "distributor" ? firms[0] : undefined);
  if (!firm) return fail(404, "Distributor not found.");
  const tally = (await one<{ tally_name: string | null }>(`select tally_name from fp_firm where uid = $1`, [firm.uid]))?.tally_name?.trim();
  if (!tally) return fail(409, "Your account isn't linked to Gaia's books yet. Please contact Gaia.");
  const ledger = await distLedger(tally, Number(sp.get("months")) || 3);
  return ledger ? NextResponse.json({ ledger }) : fail(503, "Your account can't be read right now. Please try again later.");
}
