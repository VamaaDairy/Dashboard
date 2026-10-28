import "server-only";

/**
 * Sends a transactional SMS through smsfortius.in. The sender id and template id are the DLT-approved
 * ones, and the text must match the approved template or the operator drops it.
 * Without SMS_SENDER_ID / SMS_TEMPLATE_ID (local development) the message is printed to the server log instead.
 */
export async function sendSms(phone: string, message: string): Promise<void> {
  const key = process.env.SMS_API_KEY, sender = process.env.SMS_SENDER_ID, template = process.env.SMS_TEMPLATE_ID;
  if (!key || !sender || !template) {
    if (process.env.NODE_ENV === "production") throw new Error("SMS is not configured (SMS_API_KEY, SMS_SENDER_ID, SMS_TEMPLATE_ID).");
    console.log(`[sms:dev] to ${phone}: ${message}`);
    return;
  }
  const url = new URL(process.env.SMS_API_URL ?? "http://smsfortius.in/V2/");
  url.search = new URLSearchParams({ apikey: key, senderid: sender, templateid: template, number: phone, message }).toString();
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`SMS gateway answered ${res.status}`);
  // the gateway answers 200 even when it refuses (no credit, bad key ...): only code "011" means the SMS was submitted
  const body = await res.text();
  let reply: { status?: unknown; code?: unknown; description?: unknown } | null = null;
  try {
    reply = JSON.parse(body);
  } catch {}
  if (String(reply?.code ?? "") !== "011") {
    throw new Error(`SMS gateway refused: ${reply ? `${reply.code ?? "?"} ${reply.description ?? reply.status ?? ""}`.trim() : body.slice(0, 200)}`);
  }
}
