import "server-only";
import { createHash } from "node:crypto";

/**
 * Easebuzz Autocollect (Recurring Payment) - UPI Autopay mandates and their debits.
 * https://docs.easebuzz.in/docs/8-autocollect-recurring-payment
 *
 * Same account settings as the checkout (src/lib/payments/easebuzz.ts): EASEBUZZ_KEY, EASEBUZZ_SALT and
 * EASEBUZZ_ENV ("prod" = live money, anything else = Easebuzz's sandbox). Autocollect must be switched on for the
 * account by Easebuzz, and AUTOPAY_ENABLED=1 set here once it is (until then nothing autopay runs). Every call is signed with a SHA-512 of fields and the salt (the salt itself never leaves us).
 */

const KEY = process.env.EASEBUZZ_KEY ?? "";
const SALT = process.env.EASEBUZZ_SALT ?? "";
const LIVE = process.env.EASEBUZZ_ENV === "prod";
const API = LIVE ? "https://api.easebuzz.in/autocollect" : "https://sandboxapi.easebuzz.in/autocollect";
/** Easebuzz's own page where the customer approves the mandate in their UPI app (the "redirect" method). */
const PAY = LIVE ? "https://pay.easebuzz.in/pay/" : "https://testpay.easebuzz.in/pay/";

/** Easebuzz has switched Autocollect on for the account and we turned it on here (AUTOPAY_ENABLED=1). */
export const autocollectReady = () => !!KEY && !!SALT && process.env.AUTOPAY_ENABLED === "1";
export const isLive = () => LIVE;

const sha512 = (s: string) => createHash("sha512").update(s, "utf8").digest("hex");
/** Easebuzz signs fields joined by "|" with the salt last. */
export const sign = (...parts: Array<string | number>) => sha512([...parts.map(String), SALT].join("|"));
/** Amounts go as numbers with at most two decimals; the same text is used in the signature. */
export const amountText = (n: number) => String(Math.round(n * 100) / 100);

export class EasebuzzError extends Error {
  constructor(message: string, readonly status: number, readonly body: unknown) {
    super(message);
  }
}

type Json = Record<string, unknown>;

/** For tests: replaces fetch. */
let fetcher: typeof fetch = (...a) => fetch(...a);
export const setFetcher = (f: typeof fetch) => {
  fetcher = f;
};

async function call(method: "GET" | "POST", path: string, auth: string, body?: Json): Promise<Json> {
  const url = `${API}${path}${method === "GET" ? `?key=${encodeURIComponent(KEY)}` : ""}`;
  const res = await fetcher(url, {
    method,
    headers: { accept: "application/json", "content-type": "application/json", Authorization: auth, "X-EB-MERCHANT-KEY": KEY },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  let j: Json;
  try {
    j = JSON.parse(text) as Json;
  } catch {
    throw new EasebuzzError(`Easebuzz answered ${res.status}: ${text.slice(0, 200)}`, res.status, text);
  }
  if (!res.ok || j.success === false) {
    const msg = (j.message ?? j.error ?? j.description ?? (j.data as Json | undefined)?.message ?? `HTTP ${res.status}`) as string;
    throw new EasebuzzError(typeof msg === "string" ? msg : JSON.stringify(msg), res.status, j);
  }
  return j;
}

const data = (j: Json) => (j.data ?? {}) as Json;

export interface MandateRequest {
  txnId: string;
  maxAmount: number;
  startDate: string;
  endDate: string;
  phone: string;
  email: string;
  successUrl: string;
  failureUrl: string;
  /** Who it is for, kept by Easebuzz with the mandate (letters, digits, spaces). */
  note?: string;
}

/**
 * Step 1 of a mandate: an access key for Easebuzz's approval page. "as_presented" with a MAX rule: each debit is
 * whatever was delivered, never above [maxAmount]; UPI app approval only.
 */
export async function mandateAccessKey(m: MandateRequest): Promise<{ accessKey: string; url: string }> {
  const amount = amountText(m.maxAmount);
  const j = await call("POST", "/v1/access-key/generate/", sign(KEY, amount, m.txnId), {
    key: KEY,
    transaction_id: m.txnId,
    success_url: m.successUrl,
    failure_url: m.failureUrl,
    request_type: "DEFAULT",
    amount: Number(amount),
    email: m.email,
    phone: m.phone,
    start_date: m.startDate,
    end_date: m.endDate,
    frequency: "as_presented",
    amount_rule: "MAX",
    payment_modes: ["UPIAD"],
    udf1: (m.note ?? "").replace(/[^A-Za-z0-9 ]+/g, " ").slice(0, 60),
  });
  const accessKey = String(j.access_key ?? "");
  if (!accessKey) throw new EasebuzzError("Easebuzz did not return an access key.", 200, j);
  return { accessKey, url: `${PAY}${accessKey}` };
}

export interface MandateInfo {
  status: string;
  id: string | null;
  umrn: string | null;
  upiHandle: string | null;
  raw: Json;
}

/** A mandate as Easebuzz has it now (by our transaction id). */
export async function getMandate(txnId: string): Promise<MandateInfo> {
  const d = data(await call("GET", `/v1/mandate/${encodeURIComponent(txnId)}/`, sign(KEY, txnId)));
  return {
    status: String(d.status ?? "unknown"),
    id: d.id ? String(d.id) : null,
    umrn: d.umrn ? String(d.umrn) : null,
    upiHandle: d.customer_upi_handle ? String(d.customer_upi_handle) : null,
    raw: d,
  };
}

/** Tells the customer's bank about a debit of [amount] (mandatory at least 24 h before it). */
export async function notifyDebit(txnId: string, notifyNo: string, amount: number): Promise<{ status: string; raw: Json }> {
  const a = amountText(amount);
  const d = data(
    await call("POST", "/v1/mandate/notify/", sign(KEY, txnId, notifyNo, a), {
      key: KEY,
      transaction_id: txnId,
      notification_request_number: notifyNo,
      amount: Number(a),
      schedule_presentment: false,
      fetch_balance: false,
      force_presentment: false,
    }),
  );
  return { status: String(d.status ?? "in_process"), raw: d };
}

export async function getNotification(notifyNo: string): Promise<{ status: string; raw: Json }> {
  const d = data(await call("GET", `/v1/mandate/notification/${encodeURIComponent(notifyNo)}/`, sign(KEY, notifyNo)));
  return { status: String(d.status ?? "unknown"), raw: d };
}

/** The debit itself, for exactly the notified amount. */
export async function executeDebit(txnId: string, notifyNo: string, debitNo: string, amount: number): Promise<{ status: string; raw: Json }> {
  const a = amountText(amount);
  const d = data(
    await call("POST", "/v1/mandate/execute/", sign(KEY, txnId, debitNo, a), {
      key: KEY,
      transaction_id: txnId,
      amount: Number(a),
      notification_request_number: notifyNo,
      merchant_request_number: debitNo,
      fetch_balance: false,
      force_presentment: false,
    }),
  );
  return { status: String(d.status ?? "in_process"), raw: d };
}

export async function getDebit(debitNo: string): Promise<{ status: string; raw: Json }> {
  const d = data(await call("GET", `/v1/mandate/presentment/${encodeURIComponent(debitNo)}/`, sign(KEY, debitNo)));
  return { status: String(d.status ?? "unknown"), raw: d };
}

/** Why Easebuzz / the bank said no, in its own words. */
export const reasonOf = (raw: Json): string => {
  const m = (raw.response_meta ?? raw.error_meta ?? {}) as Json;
  return String(m.description ?? raw.failure_reason ?? raw.status ?? "failed").slice(0, 200);
};
