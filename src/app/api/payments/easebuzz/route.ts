import { NextResponse, type NextRequest } from "next/server";
import { applyReply } from "@/lib/payments/easebuzz";

export const dynamic = "force-dynamic";

/**
 * Easebuzz's result for a payment: its webhook (set this URL in the Easebuzz dashboard) and the success /
 * failure URL (surl / furl) both post the transaction here as a form. It counts only when its hash, made
 * with our salt, checks out (lib/payments/easebuzz.ts). A browser coming back is shown a short page.
 */
export async function POST(req: NextRequest) {
  let fields: Record<string, string> = {};
  try {
    const type = req.headers.get("content-type") ?? "";
    if (type.includes("application/json")) fields = (await req.json()) as Record<string, string>;
    else fields = Object.fromEntries([...(await req.formData()).entries()].map(([k, v]) => [k, String(v)]));
  } catch {
    return NextResponse.json({ ok: false, error: "Unreadable body" }, { status: 400 });
  }
  // a browser (the customer's phone back from the checkout) asks for a page; Easebuzz's webhook does not
  const page = (req.headers.get("accept") ?? "").includes("text/html");
  const r = await applyReply(fields, page ? "payment page" : "webhook");

  if (page) {
    const paid = r.ok && r.status === "success";
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Gaia</title></head>
<body style="font-family:system-ui,sans-serif;text-align:center;padding:48px 20px;color:#111827">
<h2>${paid ? "Payment received" : "Payment not completed"}</h2>
<p style="color:#6b7280">${paid ? "Thank you! Your order is placed." : "No money was taken, or it will be returned."} You can go back to the Gaia app now.</p>
</body></html>`;
    return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8" } });
  }
  // Easebuzz only needs a 200 for its webhook; a bad hash gets a 400 so it shows in their logs
  return NextResponse.json({ ok: r.ok }, { status: r.ok || r.error !== "Hash mismatch" ? 200 : 400 });
}
