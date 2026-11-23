import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { customerFromRequest } from "@/lib/shop/customer";
import { mandateLimit, subscriptionMandate } from "@/lib/shop/autopay";
import { nextPack, packState, parsePeriod, periodLabel, periodOf, raisePack, refreshPack, setPeriod } from "@/lib/shop/packs";
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
  // subscriptions are paid by autopay (UPI or eNACH), never cash: the app sets autopay up first ({ code } tells it
  // to). An eNACH mandate the bank is still approving is enough to save the plan; deliveries start once it is approved.
  const mandate = await subscriptionMandate(c.id);
  if (!mandate) {
    return NextResponse.json({ error: "Set up autopay to start a subscription.", code: "autopay_required" }, { status: 402 });
  }
  // on autopay it is paid a period at a time (4 weeks, a month, up to a date - body.period { unit, len }, or the
  // customer's last choice): that pack has to fit the autopay's limit
  const plan = { endDate: null, ...p.plan } as PlanInput;
  const period = b.period === undefined ? null : parsePeriod(b.period);
  if (b.period !== undefined && !period) return fail(400, "Choose how long to pay for: 4 weeks, a month, or a date up to a year ahead.");
  if (mandate) {
    const quote = await nextPack(c.id, [{
      id: -1, sku_code: plan.sku, qty: plan.qty, frequency: plan.frequency, weekdays: plan.weekdays, every_n: plan.everyN,
      start_date: plan.startDate, end_date: plan.endDate, status: "active", renew: true, ends_after_day: null,
    }], undefined, period ?? (await periodOf(c.id)));
    const limit = await mandateLimit(c.id);
    if (quote && limit != null && quote.amount > limit) {
      return NextResponse.json(
        { error: `${periodLabel(period ?? (await periodOf(c.id)))} of deliveries (${quote.days}) cost ${rupees(quote.amount)}, more than your autopay limit of ${rupees(limit)}. Choose a shorter period, or set up autopay again with a higher limit.`, code: "over_limit" },
        { status: 400 },
      );
    }
  }

  const name = String(b.name ?? c.name ?? "").trim();
  const phone = String(b.phone ?? c.phone ?? "").replace(/\D/g, "").slice(-10);
  const address = String(b.address ?? c.address ?? "").trim();
  if (name.length < 2) return fail(400, "Enter your name.");
  if (!/^[6-9]\d{9}$/.test(phone)) return fail(400, "Enter a valid 10-digit mobile number.");
  if (address.length < 5) return fail(400, "Add the delivery address for your subscription.");
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

  if (mandate && period) await setPeriod(c.id, period);
  const r = await createSubscription(c.id, plan, {
    name, phone, address,
    pincode: typeof b.pincode === "string" && b.pincode.trim() ? b.pincode.trim() : c.pincode,
    lat: num(b.lat) ?? c.lat, lng: num(b.lng) ?? c.lng,
  });
  if (!r.ok) return fail(400, r.error);
  // days the customer took out while choosing
  if (Array.isArray(b.skipDays)) for (const d of b.skipDays.slice(0, 120)) if (typeof d === "string") await setDay(c.id, r.id, d, 0);
  if (!mandate) return NextResponse.json({ id: r.id }, { status: 201 });
  // the first pack (or, with one still waiting to go to the bank, that one priced again to take this in)
  const st = await packState(c.id);
  if (st.open?.status === "pending") await refreshPack(st.open.id, c.id);
  const pack = await raisePack(c.id); // the one on its way, else a new one
  return NextResponse.json(
    { id: r.id, pack: pack ? { status: pack.status, amount: pack.amount, days: pack.days } : null, daysLeft: (await packState(c.id)).daysLeft },
    { status: 201 },
  );
}
