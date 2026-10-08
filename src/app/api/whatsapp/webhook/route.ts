import { createHmac, timingSafeEqual } from "node:crypto";
import { after, NextResponse, type NextRequest } from "next/server";
import { wa } from "@/lib/whatsapp/config";
import { processWebhook } from "@/lib/whatsapp/inbound";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Meta's one-time check when the callback URL is saved in the app dashboard. */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  if (p.get("hub.mode") === "subscribe" && wa.verifyToken && p.get("hub.verify_token") === wa.verifyToken) {
    return new NextResponse(p.get("hub.challenge") ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

/** Every incoming message and delivery receipt. Answer at once; the work happens after. */
export async function POST(req: NextRequest) {
  const raw = await req.text();

  if (wa.appSecret) {
    const sig = req.headers.get("x-hub-signature-256") ?? "";
    const expected = `sha256=${createHmac("sha256", wa.appSecret).update(raw).digest("hex")}`;
    const ok = sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    if (!ok) return new NextResponse("Bad signature", { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new NextResponse("Bad JSON", { status: 400 });
  }

  after(() =>
    processWebhook(body as Parameters<typeof processWebhook>[0]).catch((e) => console.error("[whatsapp] webhook", e)),
  );
  return NextResponse.json({ ok: true });
}
