import { type NextRequest } from "next/server";
import { refreshMandate } from "@/lib/shop/autopay";

export const dynamic = "force-dynamic";

/**
 * Where Easebuzz's mandate page sends the customer back (success and failure alike, GET or POST). The outcome is
 * read from Easebuzz's API, not from the redirect; the page just says what happened and how to get back to the app.
 */
async function page(req: NextRequest) {
  const txn = req.nextUrl.searchParams.get("m") ?? "";
  const m = /^GM\d+T[0-9A-Z]+$/.test(txn) ? await refreshMandate(txn) : null;
  const ok = m?.status === "authorized";
  const waiting = m && ["requested", "initiated"].includes(m.status);
  const title = ok ? "Autopay is on" : waiting ? "Almost done" : "Autopay was not set up";
  const text = ok
    ? "Your Gaia subscription will be paid automatically. You'll be told a day before every debit."
    : waiting
      ? "Approve the request in your UPI app. The Gaia app updates as soon as it's approved."
      : "Nothing was set up and no money was taken. You can try again from the Gaia app.";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} | Gaia</title><style>
body{margin:0;background:#F7F5E8;color:#2F3992;font-family:system-ui,-apple-system,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center}
main{max-width:360px;padding:32px 24px;text-align:center}h1{font-size:26px;margin:0 0 12px}p{color:#4b5563;line-height:1.5;margin:0 0 24px}
a{display:inline-block;background:#2F3992;color:#fff;text-decoration:none;padding:14px 28px;border-radius:14px;font-weight:700}
.i{font-size:48px;margin-bottom:12px}</style></head><body><main><div class="i">${ok ? "✅" : waiting ? "⏳" : "⚠️"}</div>
<h1>${title}</h1><p>${text}</p><a href="gaiashop://autopay">Back to the Gaia app</a></main></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

export const GET = page;
export const POST = page;
