import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { distFromRequest, MAX_LINE_QTY, quoteDistOrder } from "@/lib/distributor";

export const dynamic = "force-dynamic";

/**
 * The cart priced as it would be placed: the party's prices and the partner offers that apply. Body: { firmUid?,
 * lines: [{ sku, qty, packs? }], code? }. Returns { lines: [{ sku, name, qty, rate, listRate, total, discount, free,
 * offer }], applied, gross, discount, total, freeWorth, code, codeStatus, codeMessage, hints }.
 */
export async function POST(req: NextRequest) {
  const login = await distFromRequest(req);
  if (!login) return fail(401, "Please sign in again.");
  if (tooMany(req, "dist-quote", 120)) return fail(429, "Too many requests. Please wait a minute.");
  const b = (await readJson(req, 20_000)) as { firmUid?: unknown; lines?: unknown; code?: unknown } | null;
  if (!b || !Array.isArray(b.lines)) return fail(400, "Invalid cart.");
  const lines = b.lines.map((l) => {
    const x = l as { sku?: unknown; qty?: unknown; packs?: unknown };
    return { sku: String(x?.sku ?? ""), qty: Number(x?.qty), packs: x?.packs === undefined || x?.packs === null ? null : Number(x.packs) };
  });
  if (lines.some((l) => !l.sku || !Number.isInteger(l.qty) || l.qty < 1 || l.qty > MAX_LINE_QTY)) return fail(400, "Check the quantities.");
  const r = await quoteDistOrder(login, {
    firmUid: typeof b.firmUid === "string" ? b.firmUid : undefined,
    lines,
    code: typeof b.code === "string" ? b.code.slice(0, 30) : null,
  });
  if (!r.ok) return fail(400, r.error);
  const q = r.quote;
  return NextResponse.json({
    lines: q.lines.map((l) => ({ sku: l.sku, name: l.name, qty: l.qty, rate: l.rate, listRate: l.dp, total: l.total, discount: l.discount, free: l.free, offer: l.offerTitle })),
    applied: q.applied, gross: q.gross, discount: q.discount, total: q.total, freeWorth: q.freeWorth,
    code: q.code, codeStatus: q.codeStatus, codeMessage: q.codeMessage, hints: q.hints,
  });
}
