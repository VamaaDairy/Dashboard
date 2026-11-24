import type { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { jsonWithEtag } from "@/lib/shop/api";

export const dynamic = "force-dynamic";

/** The states as Customer Masters lists them, for the onboarding form (so the office's approval matches exactly). */
export async function GET(req: NextRequest) {
  const rows = await query<{ state: string }>(`select state from fp_state where coalesce(trim(state), '') <> '' order by state`);
  return jsonWithEtag(req, { states: rows.map((r) => r.state) }, 3600);
}
