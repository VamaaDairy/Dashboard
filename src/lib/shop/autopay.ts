import "server-only";
import { one, query } from "@/lib/db";
import * as eb from "@/lib/payments/autocollect";
import { notify } from "@/lib/push";
import * as packs from "./packs";

/**
 * Subscriptions are paid by autopay only (Easebuzz Autocollect), a chosen period at a time (src/lib/shop/packs.ts).
 *
 *   1. While subscribing, the customer sets up one mandate: Easebuzz's page, where they pick UPI Autopay (approved
 *      in their UPI app) or eNACH (their bank account; the bank approves it in 24-48 h) - "as presented", up to a
 *      maximum per debit.
 *   2. Each pack is a charge (kind 'pack'). UPI: in the evening debit window the bank is told the amount (NPCI: at
 *      least 24 h ahead), the next evening it is debited. eNACH: no notice - the debit is raised that evening,
 *      Easebuzz hands it to the bank at 7 AM, the answer comes 24-48 h later. Easebuzz's webhook and our own
 *      polling move a charge on; every status is read back from Easebuzz's API, never taken from a post.
 *   3. A failed notice or debit is tried again the next evening; after [MAX_ATTEMPTS] the pack is 'unpaid' and the
 *      customer can try again in the app.
 *
 * AUTOPAY_FAST=1 (sandbox only) ignores the debit window and the 24-hour wait, for testing.
 */

export const MAX_ATTEMPTS = 3;
/** The mandate's limit is per debit - a whole pack (30 deliveries), so a month's milk, not a day's. */
export const DEFAULT_MAX = 5000;
export const MIN_MAX = 500;
/** UPI Autopay debits above ₹15,000 need the customer's PIN each time, so this is the ceiling. */
export const MAX_MAX = 15000;
const fast = () => process.env.AUTOPAY_FAST === "1" && !eb.isLive();
const PUBLIC_URL = (process.env.SHOP_PUBLIC_URL ?? "https://production.vamadairy.in").replace(/\/+$/, "");
const EMAIL = process.env.EASEBUZZ_EMAIL ?? "payments@vamaadairy.com";

const ACTIVE = "authorized";
const PENDING_STATES = ["requested", "initiated"];
/** how long the app shows a mandate as "waiting": UPI is approved in minutes, eNACH by the bank in up to 2 days */
const PENDING_FOR = { upi: 30 * 60 * 1000, enach: 3 * 24 * 3600 * 1000 };
const by = (kind: string | null) => (kind === "enach" ? "your bank account" : "UPI Autopay");
const rupees = (n: number) => `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

// ---------------------------------------------------------------- time

/** The time in India as hours + minutes / 60. */
export function istHour(now = new Date()): number {
  const [h, m] = now.toLocaleString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }).split(":").map(Number);
  return (h % 24) + m / 60;
}

/**
 * NPCI lets UPI Autopay debits run only off-peak (00:00-10:00, 13:00-17:00, 21:30-23:59 India). We notify and
 * debit in the evening slot, after the day's deliveries, keeping clear of its edges; the debit lands ~24 h after
 * its notice, in the same slot.
 */
export const inDebitWindow = (now = new Date()) => fast() || (istHour(now) >= 21.6 && istHour(now) < 23.8);

const DAY = 24 * 3600 * 1000;

// ---------------------------------------------------------------- mandates

export interface Mandate {
  id: number;
  customer_id: number;
  txn_id: string;
  status: string;
  max_amount: number;
  start_date: string;
  end_date: string;
  access_key: string | null;
  upi_handle: string | null;
  kind: eb.MandateKind | null;
  bank_account: string | null;
  authorized_at: Date | null;
  created_at: Date;
}
const M_COLS = `id, customer_id, txn_id, status, max_amount::float as max_amount, start_date::text, end_date::text, access_key, upi_handle, kind, bank_account, authorized_at, created_at`;

/** The customer's authorised, unexpired mandate, if any. */
export const activeMandate = (customerId: number) =>
  one<Mandate>(
    `select ${M_COLS} from shop_mandate where customer_id = $1 and status = '${ACTIVE}' and end_date >= current_date order by authorized_at desc nulls last limit 1`,
    [customerId],
  );

/**
 * Whether the customer may start a subscription when autopay is required: with an authorised mandate, or with an
 * eNACH mandate the bank is still approving (up to 2 days). In the second case the subscription is saved, but no
 * order is made for it until the mandate is authorised (generateOrders checks that every day).
 */
export async function subscriptionMandate(customerId: number): Promise<"active" | "approving" | null> {
  if (await activeMandate(customerId)) return "active";
  const m = await one<{ id: number }>(
    `select id from shop_mandate where customer_id = $1 and kind = 'enach' and status = any($2) and created_at > now() - interval '3 days' limit 1`,
    [customerId, PENDING_STATES],
  );
  return m ? "approving" : null;
}

/** The limit per debit of the mandate that pays the customer's packs (authorised, or eNACH being approved). */
export async function mandateLimit(customerId: number): Promise<number | null> {
  const m = await one<{ max_amount: number }>(
    `select max_amount::float as max_amount from shop_mandate
      where customer_id = $1 and ((status = '${ACTIVE}' and end_date >= current_date) or (kind = 'enach' and status = any($2) and created_at > now() - interval '3 days'))
      order by (status = '${ACTIVE}') desc, created_at desc limit 1`,
    [customerId, PENDING_STATES],
  );
  return m?.max_amount ?? null;
}

const latestMandate = (customerId: number) =>
  one<Mandate>(`select ${M_COLS} from shop_mandate where customer_id = $1 order by created_at desc limit 1`, [customerId]);

const istDate = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export type StartMandate = { ok: true; url: string; txnId: string } | { ok: false; status: number; error: string };

/** Begins a mandate: returns the Easebuzz page the app opens so the customer can approve it in their UPI app. */
export async function startMandate(c: { id: number; name: string; phone: string }, maxAmount = DEFAULT_MAX): Promise<StartMandate> {
  if (!eb.autocollectReady()) return { ok: false, status: 503, error: "Autopay is not available right now." };
  const max = Math.round(Number(maxAmount));
  if (!Number.isFinite(max) || max < MIN_MAX || max > MAX_MAX) return { ok: false, status: 400, error: `Choose a limit between ${rupees(MIN_MAX)} and ${rupees(MAX_MAX)}.` };
  if (await activeMandate(c.id)) return { ok: false, status: 409, error: "Autopay is already set up." };
  const phone = c.phone.replace(/\D/g, "").slice(-10);
  if (!/^[2-9]\d{9}$/.test(phone)) return { ok: false, status: 400, error: "Your account needs a valid mobile number." };

  const now = new Date();
  const start = istDate(now);
  const end = istDate(new Date(now.getTime() + 3 * 365 * DAY)); // three years; renewed by setting up again
  const txnId = `GM${c.id}T${now.getTime().toString(36).toUpperCase()}`;
  const m = await one<{ id: number }>(
    `insert into shop_mandate (customer_id, txn_id, max_amount, start_date, end_date) values ($1, $2, $3, $4, $5) returning id`,
    [c.id, txnId, max, start, end],
  );
  const back = `${PUBLIC_URL}/api/shop/autopay/return?m=${txnId}`;
  try {
    const r = await eb.mandateAccessKey({ txnId, maxAmount: max, startDate: start, endDate: end, phone, email: EMAIL, successUrl: back, failureUrl: back, note: c.name });
    await query(`update shop_mandate set access_key = $2, updated_at = now() where id = $1`, [m!.id, r.accessKey]);
    return { ok: true, url: r.url, txnId };
  } catch (e) {
    await query(`update shop_mandate set status = 'failed', raw = $2, updated_at = now() where id = $1`, [m!.id, JSON.stringify({ error: String(e) })]);
    console.error("[autopay] access key failed:", e instanceof Error ? e.message : e);
    return { ok: false, status: 502, error: "Could not start autopay. Please try again in a minute." };
  }
}

/** Reads a mandate back from Easebuzz and stores what it says. Tells the customer when autopay starts or stops. */
export async function refreshMandate(txnId: string): Promise<Mandate | null> {
  const was = await one<Mandate>(`select ${M_COLS} from shop_mandate where txn_id = $1`, [txnId]);
  if (!was) return null;
  let info: eb.MandateInfo;
  try {
    info = await eb.getMandate(txnId);
  } catch (e) {
    console.error("[autopay] mandate status failed:", e instanceof Error ? e.message : e);
    return was;
  }
  const now = await one<Mandate>(
    `update shop_mandate set status = $2, easebuzz_id = coalesce($3, easebuzz_id), umrn = coalesce($4, umrn), upi_handle = coalesce($5, upi_handle),
            raw = $6, kind = coalesce($7, kind), bank_account = coalesce($8, bank_account), authorized_at = case when $2 = '${ACTIVE}' then coalesce(authorized_at, now()) else authorized_at end, updated_at = now()
      where id = $1 returning ${M_COLS}`,
    [was.id, info.status, info.id, info.umrn, info.upiHandle, JSON.stringify(info.raw), info.kind, info.bankAccount],
  );
  if (was.status !== info.status) {
    if (info.status === ACTIVE) {
      await notify("customer", was.customer_id, {
        title: "Autopay is on",
        body:
          info.kind === "enach"
            ? `Your Gaia subscription is now paid automatically from your bank account, up to ${rupees(was.max_amount)} a day.`
            : `Your Gaia subscription is now paid automatically, up to ${rupees(was.max_amount)} a day. You're told a day before each debit.`,
        data: { screen: "autopay" },
      });
    } else if (PENDING_STATES.includes(was.status) && (info.kind ?? was.kind) === "enach" && !PENDING_STATES.includes(info.status)) {
      // the bank said no to an eNACH mandate (the customer was not watching: it takes up to 2 days)
      await notify("customer", was.customer_id, {
        title: "Autopay was not approved",
        body: "Your bank did not approve the autopay for your Gaia subscription. Set it up again in the app so your deliveries can start.",
        data: { screen: "autopay" },
      });
    } else if (was.status === ACTIVE) {
      await notify("customer", was.customer_id, {
        title: "Autopay has stopped",
        body: `Your Gaia autopay (${by(info.kind ?? was.kind)}) was cancelled. Set it up again in the app to keep your subscription running.`,
        data: { screen: "autopay" },
      });
    }
  }
  return now;
}

// ---------------------------------------------------------------- what the app shows

export interface AutopayView {
  /** none: never set up / stopped; pending: waiting for the UPI app; active */
  state: "none" | "pending" | "active";
  required: boolean;
  available: boolean;
  maxAmount: number | null;
  /** upi / enach; null while the customer has not picked one yet */
  kind: eb.MandateKind | null;
  upiHandle: string | null;
  /** eNACH: the bank account, masked */
  bankAccount: string | null;
  validTill: string | null;
  lastStatus: string | null;
  /** orderNo is a label for a pack ("30 deliveries"), kept for apps that always expect one */
  charges: Array<{ kind: "delivery" | "pack"; days: number | null; orderNo: string; day: string | null; amount: number; status: string; failure: string | null; paidAt: string | null }>;
  /** subscription packs: paid delivery days left, until when, and the next pack */
  pack: {
    daysLeft: number;
    paidTill: string | null;
    balance: number;
    open: { status: string; amount: number; days: number } | null;
    /** the last pack could not be collected: the app offers "Try again" */
    unpaid: boolean;
  } | null;
  /** how long each subscription payment covers (the customer's choice) */
  period: packs.Period;
}

export async function autopayView(customerId: number): Promise<AutopayView> {
  const active = await activeMandate(customerId);
  const last = active ?? (await latestMandate(customerId));
  const fresh = last && PENDING_STATES.includes(last.status) && Date.now() - new Date(last.created_at).getTime() < PENDING_FOR[last.kind ?? "upi"];
  const charges = await query<{ kind: "delivery" | "pack"; days: number | null; order_no: string | null; day: string | null; amount: number; status: string; failure: string | null; paid_at: Date | null }>(
    `select c.kind, c.days, o.order_no, o.subscription_day::text as day, c.amount::float as amount, c.status, c.failure, c.paid_at
       from shop_charge c left join shop_order o on o.id = c.order_id
      where c.customer_id = $1 and c.status <> 'cancelled' order by c.created_at desc limit 30`,
    [customerId],
  );
  const st = await packs.packState(customerId);
  const hasPacks = st.paidDays > 0 || !!st.open || st.lastUnpaid;
  return {
    state: active ? "active" : fresh ? "pending" : "none",
    required: true, // subscriptions are paid by autopay only
    available: eb.autocollectReady(),
    maxAmount: last?.max_amount ?? null,
    kind: last?.kind ?? null,
    upiHandle: active?.upi_handle ?? null,
    bankAccount: active?.bank_account ?? null,
    validTill: active?.end_date ?? null,
    lastStatus: last?.status ?? null,
    charges: charges.map((c) => ({
      kind: c.kind, days: c.days, orderNo: c.order_no ?? `${c.days} deliveries`, day: c.day, amount: c.amount, status: c.status, failure: c.failure,
      paidAt: c.paid_at ? new Date(c.paid_at).toISOString() : null,
    })),
    pack: hasPacks
      ? {
          daysLeft: st.daysLeft,
          paidTill: await packs.paidTill(customerId, st),
          balance: st.balance,
          open: st.open ? { status: st.open.status, amount: st.open.amount, days: st.open.days } : null,
          unpaid: st.lastUnpaid,
        }
      : null,
    period: await packs.periodOf(customerId),
  };
}

// ---------------------------------------------------------------- charges

interface Charge {
  id: number;
  order_id: number | null;
  /** 'delivery' (one order) or 'pack' ([days] deliveries) */
  ckind: "delivery" | "pack";
  days: number | null;
  customer_id: number;
  amount: number;
  status: string;
  attempts: number;
  notify_no: string | null;
  debit_no: string | null;
  notified_at: Date | null;
  txn_id: string | null;
  kind: eb.MandateKind | null;
  /** the mandate's limit per debit */
  max_amount: number | null;
  order_no: string;
}
const C_SELECT = `select c.id, c.order_id, c.kind as ckind, c.days, c.customer_id, c.amount::float as amount, c.status, c.attempts, c.notify_no, c.debit_no, c.notified_at,
                         am.txn_id, am.kind, am.max_amount, coalesce(o.order_no, 'pack') as order_no
                    from shop_charge c left join shop_order o on o.id = c.order_id
                    left join lateral (select m.txn_id, m.kind, m.max_amount::float as max_amount from shop_mandate m
                                        where m.customer_id = c.customer_id and m.status = '${ACTIVE}' and m.end_date >= current_date
                                        order by m.authorized_at desc nulls last limit 1) am on true`;

/** Moves a charge on only if it is still where we left it - two runs can never act on it twice. */
async function claim(id: number, from: string, to: string, set = ""): Promise<boolean> {
  const r = await query(`update shop_charge set status = $3, updated_at = now() ${set} where id = $1 and status = $2 returning id`, [id, from, to]);
  return r.length > 0;
}

async function failed(c: Charge, reason: string): Promise<void> {
  const last = c.attempts >= MAX_ATTEMPTS;
  await query(`update shop_charge set status = $2, failure = $3, updated_at = now() where id = $1`, [c.id, last ? "unpaid" : "pending", reason.slice(0, 200)]);
  if (last) {
    await notify("customer", c.customer_id, {
      title: "Subscription payment failed",
      body: `We couldn't collect ${rupees(c.amount)} for your next ${c.days ?? packs.PACK_DAYS} deliveries. Deliveries stop after the days already paid. Open the Gaia app to try again.`,
      data: { screen: "autopay" },
    });
  }
}

async function paid(c: Charge, raw: unknown): Promise<void> {
  const r = await query(`update shop_charge set status = 'paid', paid_at = now(), failure = null, raw = $2, updated_at = now() where id = $1 and status <> 'paid' returning id`, [c.id, JSON.stringify(raw)]);
  if (!r.length) return;
  await notify("customer", c.customer_id, {
    title: "Subscription paid",
    body: `${rupees(c.amount)} was paid by autopay from ${by(c.kind)} for your next ${c.days ?? packs.PACK_DAYS} deliveries.`,
    data: { screen: "autopay" },
  });
}

/**
 * A pack is priced again just before it goes to the bank (things may have changed since it was raised). False when
 * it is no longer to be sent (nothing renews, or the balance covers it); otherwise [c] carries the amount to send.
 */
async function packReady(c: Charge): Promise<boolean> {
  if (c.ckind !== "pack" || c.status !== "pending") return true;
  const next = await packs.refreshPack(c.id, c.customer_id);
  if (!next) return false;
  c.amount = next.amount;
  c.days = next.days;
  return true;
}

/** A debit above the mandate's limit is refused by the bank every time: no point trying (or bouncing) it. */
async function overLimit(c: Charge): Promise<boolean> {
  if (c.max_amount == null || c.amount <= c.max_amount) return false;
  await query(`update shop_charge set attempts = $2 where id = $1`, [c.id, MAX_ATTEMPTS]);
  await failed({ ...c, attempts: MAX_ATTEMPTS }, `More than the autopay limit of ${rupees(c.max_amount)}`);
  return true;
}

/** Sends the bank its notice for a pending charge (opens the 24-hour wait). */
async function sendNotice(c: Charge): Promise<void> {
  if (!c.txn_id) return; // no active mandate: the charge waits until the customer sets autopay up again
  if (!(await packReady(c))) return;
  if (await overLimit(c)) return;
  const attempt = c.attempts + 1;
  const notifyNo = `GN${c.id}A${attempt}`;
  if (!(await claim(c.id, "pending", "notifying", `, attempts = ${attempt}, notify_no = '${notifyNo}', debit_no = null, notified_at = null`))) return;
  try {
    const r = await eb.notifyDebit(c.txn_id, notifyNo, c.amount);
    if (r.status === "notified") await query(`update shop_charge set status = 'notified', notified_at = now(), raw = $2 where id = $1`, [c.id, JSON.stringify(r.raw)]);
    else if (r.status === "failure") await failed({ ...c, attempts: attempt }, eb.reasonOf(r.raw));
    else await query(`update shop_charge set raw = $2 where id = $1`, [c.id, JSON.stringify(r.raw)]);
  } catch (e) {
    await failed({ ...c, attempts: attempt }, e instanceof Error ? e.message : String(e));
  }
}

/** Debits a charge whose notice is at least 24 h old (and not past Easebuzz's 48 h limit). */
async function debit(c: Charge): Promise<void> {
  if (!c.txn_id || !c.notify_no) return failed(c, "Autopay is no longer active.");
  // the customer may have cancelled the mandate in their UPI app since the notice
  const m = await eb.getMandate(c.txn_id).catch(() => null);
  if (m && m.status !== ACTIVE) {
    await query(`update shop_mandate set status = $2, updated_at = now() where txn_id = $1`, [c.txn_id, m.status]);
    return failed({ ...c, attempts: MAX_ATTEMPTS }, `Autopay ${m.status.replace(/_/g, " ")}`);
  }
  const debitNo = `GD${c.id}A${c.attempts}`;
  if (!(await claim(c.id, "notified", "presenting", `, debit_no = '${debitNo}', presented_at = now()`))) return;
  try {
    const r = await eb.executeDebit(c.txn_id, c.notify_no, debitNo, c.amount);
    if (r.status === "success") await paid(c, r.raw);
    else if (r.status === "failure") await failed(c, eb.reasonOf(r.raw));
  } catch (e) {
    // a 5xx may still have reached the bank: the poll reads the debit back before anything is retried
    console.error("[autopay] debit call failed:", e instanceof Error ? e.message : e);
  }
}

/** eNACH: raises the debit for a pending charge straight away (no notice). The bank answers in 24-48 h. */
async function presentEnach(c: Charge): Promise<void> {
  if (!c.txn_id) return;
  if (!(await packReady(c))) return;
  if (await overLimit(c)) return;
  const m = await eb.getMandate(c.txn_id).catch(() => null);
  if (m && m.status !== ACTIVE) {
    await query(`update shop_mandate set status = $2, updated_at = now() where txn_id = $1`, [c.txn_id, m.status]);
    return failed({ ...c, attempts: MAX_ATTEMPTS }, `Autopay ${m.status.replace(/_/g, " ")}`);
  }
  const attempt = c.attempts + 1;
  const debitNo = `GD${c.id}A${attempt}`;
  if (!(await claim(c.id, "pending", "presenting", `, attempts = ${attempt}, notify_no = null, debit_no = '${debitNo}', notified_at = null, presented_at = now()`))) return;
  try {
    const r = await eb.presentDebit(c.txn_id, debitNo, c.amount);
    if (r.status === "success") await paid(c, r.raw);
    else if (r.status === "failure") await failed({ ...c, attempts: attempt }, eb.reasonOf(r.raw));
    else await query(`update shop_charge set raw = $2 where id = $1`, [c.id, JSON.stringify(r.raw)]);
  } catch (e) {
    // a 5xx may still have reached Easebuzz: the poll reads the debit back (a 404 there means it never arrived)
    console.error("[autopay] eNACH debit call failed:", e instanceof Error ? e.message : e);
  }
}

/** Reads back a charge that is waiting on Easebuzz (its notice or its debit). */
async function poll(c: Charge): Promise<void> {
  try {
    if (c.status === "notifying" && c.notify_no) {
      const r = await eb.getNotification(c.notify_no);
      if (r.status === "notified") {
        await query(`update shop_charge set status = 'notified', notified_at = coalesce(notified_at, now()), raw = $2 where id = $1 and status = 'notifying'`, [c.id, JSON.stringify(r.raw)]);
      } else if (r.status === "failure" || r.status === "cancelled") {
        await failed(c, eb.reasonOf(r.raw));
      }
    } else if (c.status === "presenting" && c.debit_no) {
      const r = await eb.getDebit(c.debit_no);
      if (r.status === "success") await paid(c, r.raw);
      else if (r.status === "failure") await failed(c, eb.reasonOf(r.raw));
      // an eNACH debit stays with the bank for 24-48 h: look again in an hour, not every few minutes
      else if (c.kind === "enach") await query(`update shop_charge set updated_at = now() where id = $1 and status = 'presenting'`, [c.id]);
    }
  } catch (e) {
    const status = e instanceof eb.EasebuzzError ? e.status : 0;
    // never reached Easebuzz (404 for our number): safe to try again from the start
    if (status === 404) await failed(c, "Not received by Easebuzz");
    else console.error("[autopay] status check failed:", e instanceof Error ? e.message : e);
  }
}

/**
 * One round of the autopay work; run every few minutes (src/instrumentation.ts). Reads back anything waiting on
 * Easebuzz, and in the evening window debits notices that are 24 h old and sends tonight's notices.
 */
export async function runAutopay(now = new Date()): Promise<{ notified: number; debited: number; checked: number }> {
  if (!eb.autocollectReady()) return { notified: 0, debited: 0, checked: 0 };
  const out = { notified: 0, debited: 0, checked: 0 };

  const waiting = await query<Charge>(
    `${C_SELECT} where c.status in ('notifying', 'presenting')
        and c.updated_at < now() - case when am.kind = 'enach' and c.status = 'presenting' then interval '1 hour' else interval '5 minutes' end
      order by c.id limit 200`,
  );
  for (const c of waiting) {
    await poll(c);
    out.checked++;
  }

  // eNACH mandates wait up to 2 days for the bank; the webhook says when, this is the safety net (hourly)
  const approving = await query<{ txn_id: string }>(
    `select txn_id from shop_mandate where kind = 'enach' and status = any($1) and created_at > now() - interval '4 days' and updated_at < now() - interval '1 hour' limit 50`,
    [PENDING_STATES],
  );
  for (const m of approving) await refreshMandate(m.txn_id);

  // packs: cancelled subscriptions end once their paid days are used; the next pack is raised a few days before
  // the paid days run out (not again by itself after one could not be collected - the customer tries again in the
  // app, or a new mandate starts it)
  const payers = await query<{ customer_id: number }>(
    `select distinct s.customer_id from shop_subscription s
      where s.status = 'active'
        and (exists (select 1 from shop_charge c where c.customer_id = s.customer_id and c.kind = 'pack')
             or exists (select 1 from shop_mandate m where m.customer_id = s.customer_id and m.status = '${ACTIVE}' and m.end_date >= current_date))`,
  );
  for (const { customer_id } of payers) {
    await packs.endFinished(customer_id);
    const st = await packs.packState(customer_id);
    if (st.open || st.daysLeft > packs.LEAD_DAYS) continue;
    if (st.lastUnpaid) {
      const m = await activeMandate(customer_id);
      if (!m?.authorized_at || !st.lastUnpaidAt || new Date(m.authorized_at) <= new Date(st.lastUnpaidAt)) continue;
    }
    await packs.raisePack(customer_id);
  }
  if (!inDebitWindow(now)) return out;

  // (fast test mode: due at once - the cutoff is a minute ahead so database and server clocks never disagree)
  const wait = fast() ? -60_000 : DAY + 5 * 60 * 1000;
  // measured from this moment, so a notice confirmed a moment ago in this same run counts correctly
  const due = await query<Charge>(`${C_SELECT} where c.status = 'notified' and c.notified_at <= $1 order by c.id limit 500`, [new Date(Date.now() - wait)]);
  for (const c of due) {
    // Easebuzz takes a debit 24-48 h after its notice; an older notice is sent again
    if (!fast() && c.notified_at && now.getTime() - new Date(c.notified_at).getTime() > 47 * 3600 * 1000) {
      await failed(c, "Notice expired before the debit");
      continue;
    }
    await debit(c);
    out.debited++;
  }

  const pending = await query<Charge>(`${C_SELECT} where c.status = 'pending' order by c.id limit 500`);
  for (const c of pending) {
    // a charge is noticed at most once per evening (a failed one waits for the next)
    if (c.attempts > 0 && !fast()) {
      const last = await one<{ updated_at: Date }>(`select updated_at from shop_charge where id = $1`, [c.id]);
      if (last && now.getTime() - new Date(last.updated_at).getTime() < 12 * 3600 * 1000) continue;
    }
    if (c.txn_id && !c.kind) {
      // never guess: a UPI notice to an eNACH mandate (or the other way round) would fail. Read it back first.
      const m = await one<{ txn_id: string }>(`select txn_id from shop_mandate where txn_id = $1`, [c.txn_id]);
      const kind = m ? (await refreshMandate(m.txn_id))?.kind ?? null : null;
      if (!kind) {
        console.error(`[autopay] charge ${c.id}: mandate ${c.txn_id} has no type yet; left for the next run`);
        continue;
      }
      c.kind = kind;
    }
    if (c.kind === "enach") {
      await presentEnach(c);
      out.debited++;
    } else {
      await sendNotice(c);
      out.notified++;
    }
  }
  return out;
}

// ---------------------------------------------------------------- webhook

/**
 * Easebuzz's Autocollect webhook. Nothing in the post is trusted: it only says which mandate or charge to read
 * back from Easebuzz's API.
 */
export async function onWebhook(body: Record<string, unknown>): Promise<string> {
  const event = String(body.event ?? "");
  const d = (body.data ?? {}) as Record<string, unknown>;
  if (event === "MANDATE_STATUS_UPDATE") {
    const txn = String(d.transaction_id ?? "");
    if (txn && (await refreshMandate(txn))) return "mandate";
    return "unknown mandate";
  }
  const key = event === "NOTIFICATION_STATUS_UPDATE" ? "notify_no" : event === "PRESENTMENT_STATUS_UPDATE" ? "debit_no" : null;
  const no = String(event === "NOTIFICATION_STATUS_UPDATE" ? d.notification_request_number ?? "" : d.merchant_request_number ?? "");
  if (!key || !no) return "ignored";
  const c = await one<Charge>(`${C_SELECT} where c.${key} = $1`, [no]);
  if (!c) return "unknown charge";
  await poll(c);
  return "charge";
}

// ---------------------------------------------------------------- dashboard

export const allMandates = () =>
  query<{ id: number; customer: string; phone: string; status: string; max_amount: number; kind: eb.MandateKind | null; upi_handle: string | null; bank_account: string | null; authorized_at: Date | null; created_at: Date }>(
    `select m.id, c.name as customer, c.phone, m.status, m.max_amount::float as max_amount, m.kind, m.upi_handle, m.bank_account, m.authorized_at, m.created_at
       from shop_mandate m join shop_customer c on c.id = m.customer_id order by m.created_at desc limit 300`,
  );

export const recentCharges = () =>
  query<{ id: number; order_no: string; customer: string; day: string | null; amount: number; status: string; attempts: number; failure: string | null; notified_at: Date | null; paid_at: Date | null }>(
    `select ch.id, coalesce(o.order_no, 'Pack · ' || ch.days || ' deliveries') as order_no, c.name as customer, o.subscription_day::text as day, ch.amount::float as amount, ch.status, ch.attempts, ch.failure, ch.notified_at, ch.paid_at
       from shop_charge ch left join shop_order o on o.id = ch.order_id join shop_customer c on c.id = ch.customer_id
      order by ch.created_at desc limit 300`,
  );
