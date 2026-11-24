import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { signupStatus } from "@/lib/distributor/requests";

export const dynamic = "force-dynamic";

/**
 * "My application": a distributor that onboarded itself follows its application before it can sign in.
 * Body: { phone, ticket } (the ticket POST /api/distributor/signup returned). Returns { status: pending | approved |
 * rejected, name, submittedAt, decidedAt, reason, canSignIn, details }; 404 for a wrong pair.
 */
export async function POST(req: NextRequest) {
  if (tooMany(req, "dist-signup-status", 30)) return fail(429, "Too many requests. Please wait a minute.");
  const b = (await readJson(req, 500)) as { phone?: unknown; ticket?: unknown } | null;
  const s = await signupStatus(String(b?.phone ?? ""), String(b?.ticket ?? ""));
  return s ? NextResponse.json(s, { headers: { "cache-control": "no-store" } }) : fail(404, "No application found for this number on this phone.");
}
