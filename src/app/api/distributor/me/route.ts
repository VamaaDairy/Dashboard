import { NextResponse, type NextRequest } from "next/server";
import { query } from "@/lib/db";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { distFromRequest, firmsFor, saveFirmDetails } from "@/lib/distributor";

export const dynamic = "force-dynamic";

/** Who is signed in, the distributors they can order for (one for a distributor, their mapped ones for a salesman) and the states a profile can be set to. */
export async function GET(req: NextRequest) {
  const login = await distFromRequest(req);
  if (!login) return fail(401, "Please sign in again.");
  const [distributors, states] = await Promise.all([firmsFor(login), query<{ state: string }>(`select state from fp_state order by state`)]);
  return NextResponse.json({ login: { kind: login.kind, name: login.name, phone: login.phone }, distributors, states: states.map((s) => s.state) });
}

/**
 * Change the distributor's own details. Body: { firmUid?, contactPerson?, phone?, email?, address?, area?, city?,
 * state?, pincode?, gstin?, pan?, licenceNo?, lat?, lng? } - only what is sent is changed. It is saved into Customer
 * Masters (with its change history), so the dashboard shows it straight away. Returns { firm, login }.
 */
export async function PATCH(req: NextRequest) {
  const login = await distFromRequest(req);
  if (!login) return fail(401, "Please sign in again.");
  if (tooMany(req, "dist-edit", 20)) return fail(429, "Too many changes. Please wait a minute.");
  const b = (await readJson(req, 5000)) as Record<string, unknown> | null;
  if (!b || typeof b !== "object") return fail(400, "Invalid request.");
  const { firmUid, ...changes } = b;
  const r = await saveFirmDetails(login, typeof firmUid === "string" ? firmUid : undefined, changes);
  return r.ok ? NextResponse.json({ firm: r.firm, login: r.login }) : fail(400, r.error, r.fields);
}
