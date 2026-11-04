import { NextResponse, type NextRequest } from "next/server";
import { onWebhook } from "@/lib/shop/autopay";

export const dynamic = "force-dynamic";

/**
 * Easebuzz Autocollect webhook (set as "Auto Debit Webhook" in the Easebuzz dashboard, test and live separately).
 * The post only says what changed; the status itself is read back from Easebuzz's API. Always 200 once received,
 * so Easebuzz does not keep re-sending; repeats are harmless.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    const text = await req.text();
    if (text.length > 200_000) return NextResponse.json({ ok: false }, { status: 413 });
    body = text.trim().startsWith("{") ? JSON.parse(text) : Object.fromEntries(new URLSearchParams(text));
    if (typeof body.data === "string") body.data = JSON.parse(body.data);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  try {
    const r = await onWebhook(body);
    return NextResponse.json({ ok: true, handled: r });
  } catch (e) {
    console.error("[autopay] webhook failed:", e instanceof Error ? e.message : e);
    // a 5xx makes Easebuzz retry later, which is what we want if our side failed
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
