import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { distFromRequest, MAX_LINE_QTY } from "@/lib/distributor";
import { listDemands, sendDemand } from "@/lib/distributor/demands";

export const dynamic = "force-dynamic";

/** A retailer: its own requirements. A distributor: its retailers' requirements (open ones first). */
export async function GET(req: NextRequest) {
  const login = await distFromRequest(req);
  if (!login) return fail(401, "Please sign in again.");
  return NextResponse.json({ demands: await listDemands(login) });
}

/**
 * A retailer sends its requirement to its distributor. Body: { notes?, lines: [{ sku, qty, packs? }] } - qty is the total
 * in pieces; packs (optional) how many of them were entered as whole crates / boxes.
 */
export async function POST(req: NextRequest) {
  const login = await distFromRequest(req);
  if (!login) return fail(401, "Please sign in again.");
  if (tooMany(req, "dist-demand", 20)) return fail(429, "Too many requests. Please wait a minute.");
  const b = (await readJson(req, 20_000)) as { notes?: unknown; lines?: unknown } | null;
  if (!b || !Array.isArray(b.lines)) return fail(400, "Invalid list.");
  const lines = b.lines.map((l) => {
    const x = l as { sku?: unknown; qty?: unknown; packs?: unknown };
    return { sku: String(x?.sku ?? ""), qty: Number(x?.qty), packs: x?.packs === undefined || x?.packs === null ? null : Number(x.packs) };
  });
  if (lines.some((l) => !l.sku || !Number.isInteger(l.qty) || l.qty < 1 || l.qty > MAX_LINE_QTY)) return fail(400, "Check the quantities.");
  if (lines.some((l) => l.packs !== null && (!Number.isInteger(l.packs) || l.packs < 0 || l.packs > l.qty))) return fail(400, "Check the quantities.");
  const r = await sendDemand(login, { notes: typeof b.notes === "string" ? b.notes : null, lines });
  return r.ok ? NextResponse.json({ id: r.id }, { status: 201 }) : fail(400, r.error);
}
