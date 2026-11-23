import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { customerFromRequest } from "@/lib/shop/customer";
import { activeMandate, MAX_DEBIT, startMandate } from "@/lib/shop/autopay";
import { nextPack, packState, parsePeriod, periodLabel, periodOf, raisePack, refreshPack, setPeriod } from "@/lib/shop/packs";
import { query } from "@/lib/db";
import { rupees } from "@/lib/shop/pricing";
import { createSubscription, customerCalendar, parsePlan, setDay, todayIST, type PlanInput } from "@/lib/shop/subscriptions";

export const dynamic = "force-dynamic";

/** The signed-in customer's subscriptions and calendar. ?from=YYYY-MM-DD (default today) &days=N (default 42, max 120). */
export async function GET(req: NextRequest) {
  const c = await customerFromRequest(req);
  if (!c) return fail(401, "Please sign in again.");
  const sp = req.nextUrl.searchParams;
  const from = /^\d{4}-\d{2}-\d{2}$/.test(sp.get("from") ?? "") ? sp.get("from")! : todayIST();
  const days = Math.min(Math.max(Number(sp.get("days")) || 42, 1), 120);
  return NextResponse.json(await customerCalendar(c.id, from, days));
}

/**
 * Start a subscription. Body: { sku, qty, frequency, weekdays?, everyN?, startDate, endDate?,
 * name, phone, address, pincode?, lat?, lng?, skipDays?: [YYYY-MM-DD] }
 */
export async function POST(req: NextRequest) {
  if (tooMany(req, "subscription", 20)) return fail(429, "Too many requests. Please wait a minute.");
  const c = await customerFromRequest(req);
  if (!c) return fail(401, "Please sign in or create an account to subscribe.");
  const b = (await readJson(req)) as Record<string, unknown> | null;
  if (!b) return fail(400, "Send a JSON body.");
  const p = parsePlan(b);
  if (!p.ok) return fail(400, p.error);
  // subscriptions are paid by UPI Autopay, a period at a time (4 weeks, a month, up to a date - body.period
  // { unit, len }, or the customer's last choice). One payment can be at most MAX_DEBIT.
  const plan = { endDate: null, ...p.plan } as PlanInput;
  const period = b.period === undefined ? null : parsePeriod(b.period);
  if (b.period !== undefined && !period) return fail(400, "Choose how long to pay for: 4 weeks, a month, or a date up to a year ahead.");
  const quote = await nextPack(c.id, [{
    id: -1, sku_code: plan.sku, qty: plan.qty, frequency: plan.frequency, weekdays: plan.weekdays, every_n: plan.everyN,
    start_date: plan.startDate, end_date: plan.endDate, status: "active", renew: true, ends_after_day: null,
  }], undefined, period ?? (await periodOf(c.id)));
  if (quote && quote.amount > MAX_DEBIT) {
    return fail(400, `${periodLabel(period ?? (await periodOf(c.id)))} of deliveries cost ${rupees(quote.amount)}; one payment can be at most ${rupees(MAX_DEBIT)}. Choose a shorter period.`);
  }

  const name = String(b.name ?? c.name ?? "").trim();
  const phone = String(b.phone ?? c.phone ?? "").replace(/\D/g, "").slice(-10);
  const address = String(b.address ?? c.address ?? "").trim();
  if (name.length < 2) return fail(400, "Enter your name.");
  if (!/^[6-9]\d{9}$/.test(phone)) return fail(400, "Enter a valid 10-digit mobile number.");
  if (address.length < 5) return fail(400, "Add the delivery address for your subscription.");
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

  if (period) await setPeriod(c.id, period);
  // without autopay yet it starts only once its first payment is made: no "started" message before that
  const autopayOn = !!(await activeMandate(c.id));
  const r = await createSubscription(c.id, plan, {
    name, phone, address,
    pincode: typeof b.pincode === "string" && b.pincode.trim() ? b.pincode.trim() : c.pincode,
    lat: num(b.lat) ?? c.lat, lng: num(b.lng) ?? c.lng,
  }, autopayOn);
  if (!r.ok) return fail(400, r.error);
  // days the customer took out while choosing
  if (Array.isArray(b.skipDays)) for (const d of b.skipDays.slice(0, 120)) if (typeof d === "string") await setDay(c.id, r.id, d, 0);
  if (!autopayOn) {
    // no autopay yet: the app opens this page - the customer's UPI app - to approve autopay and pay the first period
    const m = await startMandate(c);
    if (!m.ok) {
      // not saved without its payment - nor the payment it was going to ask for
      await query(`delete from shop_subscription where id = $1`, [r.id]);
      const open = (await packState(c.id)).open;
      if (open?.status === "pending") await refreshPack(open.id, c.id);
      return fail(m.status, m.error);
    }
    return NextResponse.json({ id: r.id, url: m.url, pack: { status: "pending", amount: m.amount, days: m.days } }, { status: 201 });
  }
  // autopay already on: the next pack (or, with one still waiting to go to the bank, that one priced again)
  const st = await packState(c.id);
  if (st.open?.status === "pending") await refreshPack(st.open.id, c.id);
  const pack = await raisePack(c.id);
  return NextResponse.json(
    { id: r.id, pack: pack ? { status: pack.status, amount: pack.amount, days: pack.days } : null, daysLeft: (await packState(c.id)).daysLeft },
    { status: 201 },
  );
}
