import "server-only";
import { one, query } from "@/lib/db";
import { pricesFor } from "./catalog";
import { deliveryRule } from "./orders";
import { deliveryFor } from "./pricing";
import { addDays, planned, todayIST, type Frequency } from "./subscriptions";

/**
 * Subscription packs (migration 119): a customer on autopay pays for their next [PACK_DAYS] delivery days at once.
 *
 *   days   paid = deliveries in paid packs; used = their 'prepaid' subscription orders that were not cancelled.
 *          A day's order is made only while paid > used, so skipped, paused and out-of-stock days use nothing and a
 *          pack lasts until its 30 deliveries are done. A cancelled order gives its day back by itself.
 *   money  balance = packs paid - totals of those orders. Each pack debits the value of the days still to come
 *          (the ones left, then the next 30) minus that balance, so a change of quantity or price, or the delivery
 *          fee, is settled exactly at the next renewal - extra is charged, unused value is taken off.
 *
 * Both are counted from the tables every time: nothing is kept that could drift.
 */

export const PACK_DAYS = 30;
/** The next pack is raised when this many paid delivery days (or fewer) are left: time for the bank (UPI notice
 * 24 h + debit; eNACH 24-48 h) before the paid days run out. */
export const LEAD_DAYS = 4;
/** A pack on its way (not settled yet). Matches the unique index shop_charge_one_open_pack. */
export const OPEN = ["pending", "notifying", "notified", "presenting", "failed"];
/** How far ahead a projection looks (every 30th day for 30 deliveries is 900 days). */
const HORIZON = 1000;

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface OpenPack {
  id: number;
  status: string;
  amount: number;
  days: number;
}

export interface PackState {
  paidDays: number;
  usedDays: number;
  /** paid delivery days still to come (never below 0) */
  daysLeft: number;
  /** packs paid minus what the prepaid orders cost: credit (+) or owed (-), settled at the next pack */
  balance: number;
  open: OpenPack | null;
  /** the last pack could not be collected (and none is on its way) */
  lastUnpaid: boolean;
  lastUnpaidAt: Date | null;
}

export async function packState(customerId: number): Promise<PackState> {
  const r = (await one<{ paid_days: number; paid_amount: number; used_days: number; used_amount: number }>(
    `select coalesce((select sum(days) from shop_charge where customer_id = $1 and kind = 'pack' and status = 'paid'), 0)::int as paid_days,
            coalesce((select sum(amount) from shop_charge where customer_id = $1 and kind = 'pack' and status = 'paid'), 0)::float as paid_amount,
            (select count(*) from shop_order where customer_id = $1 and payment_method = 'prepaid' and status <> 'cancelled')::int as used_days,
            coalesce((select sum(total) from shop_order where customer_id = $1 and payment_method = 'prepaid' and status <> 'cancelled'), 0)::float as used_amount`,
    [customerId],
  ))!;
  const open = await one<OpenPack>(
    `select id, status, amount::float as amount, days from shop_charge where customer_id = $1 and kind = 'pack' and status = any($2) order by id desc limit 1`,
    [customerId, OPEN],
  );
  const last = await one<{ status: string; updated_at: Date }>(
    `select status, updated_at from shop_charge where customer_id = $1 and kind = 'pack' order by id desc limit 1`,
    [customerId],
  );
  return {
    paidDays: r.paid_days,
    usedDays: r.used_days,
    daysLeft: Math.max(0, r.paid_days - r.used_days),
    balance: round2(r.paid_amount - r.used_amount),
    open,
    lastUnpaid: !open && last?.status === "unpaid",
    lastUnpaidAt: !open && last?.status === "unpaid" ? last.updated_at : null,
  };
}

/** Customers who pay by packs: anyone who ever had a pack, or has an authorised mandate now. */
export async function prepaidCustomers(ids: number[]): Promise<Set<number>> {
  if (!ids.length) return new Set();
  const rows = await query<{ customer_id: number }>(
    `select distinct customer_id from shop_charge where kind = 'pack' and customer_id = any($1)
     union
     select distinct customer_id from shop_mandate where status = 'authorized' and end_date >= current_date and customer_id = any($1)`,
    [ids],
  );
  return new Set(rows.map((r) => r.customer_id));
}

/** A subscription as the projection needs it (a plan not saved yet can be added the same way). */
export interface PlanSub {
  id: number;
  sku_code: string;
  qty: number;
  frequency: Frequency;
  weekdays: number[] | null;
  every_n: number | null;
  start_date: string;
  end_date: string | null;
  status: "active" | "paused" | "cancelled";
  renew: boolean;
  ends_after_day: number | null;
}

/** Is [s] still delivered on the customer's delivery day number [dayNo]? (a cancelled one runs to its last paid day) */
export const deliversOn = (s: Pick<PlanSub, "renew" | "ends_after_day">, dayNo: number) => s.renew || (s.ends_after_day != null && dayNo <= s.ends_after_day);

export interface ProjectedDay {
  day: string;
  /** the customer's delivery day number (their used days + 1, + 1 ...) */
  n: number;
  value: number;
}

/**
 * The customer's coming delivery days, as generateOrders would make them: the first [firstN] (the days already
 * paid: every subscription still running on that day number) and then [thenN] more (only subscriptions that renew).
 * Starts after the last day that already has an order. Per-day changes, out-of-stock products and the delivery fee
 * count, at today's prices.
 */
export async function projectDays(customerId: number, firstN: number, thenN: number, extra: PlanSub[] = []): Promise<ProjectedDay[]> {
  const subs = [
    ...(await query<PlanSub>(
      `select id, sku_code, qty, frequency, weekdays, every_n, to_char(start_date, 'YYYY-MM-DD') as start_date,
              to_char(end_date, 'YYYY-MM-DD') as end_date, status, renew, ends_after_day
         from shop_subscription where customer_id = $1 and status = 'active' order by id`,
      [customerId],
    )),
    ...extra,
  ];
  if (!subs.length || firstN + thenN <= 0) return [];
  const last = await one<{ day: string | null; used: number }>(
    `select to_char(max(subscription_day), 'YYYY-MM-DD') as day,
            (select count(*) from shop_order where customer_id = $1 and payment_method = 'prepaid' and status <> 'cancelled')::int as used
       from shop_order where customer_id = $1 and subscription_day is not null`,
    [customerId],
  );
  const today = todayIST();
  const start = last?.day && last.day >= today ? addDays(last.day, 1) : today;
  const end = addDays(start, HORIZON);
  const overrides = await query<{ subscription_id: number; day: string; qty: number }>(
    `select subscription_id, to_char(day, 'YYYY-MM-DD') as day, qty from shop_subscription_day
      where subscription_id = any($1) and day between $2 and $3`,
    [subs.map((s) => s.id), start, end],
  );
  const over = new Map(overrides.map((o) => [`${o.subscription_id}|${o.day}`, o.qty]));
  const prices = await pricesFor([...new Set(subs.map((s) => s.sku_code))]);

  const out: ProjectedDay[] = [];
  let n = (last?.used ?? 0) + 1;
  for (let day = start, i = 0; day <= end && out.length < firstN + thenN; day = addDays(day, 1), i++) {
    const paidPart = out.length < firstN;
    let subtotal = 0;
    for (const s of subs) {
      if (paidPart ? !deliversOn(s, n) : !s.renew) continue;
      const p = prices.get(s.sku_code);
      if (!p) continue; // out of stock: held
      const inPlan = day >= s.start_date && (!s.end_date || day <= s.end_date);
      const o = over.get(`${s.id}|${day}`);
      const qty = inPlan && o !== undefined ? o : planned(s, day) ? s.qty : 0;
      if (qty > 0) subtotal += round2(p.price * qty);
    }
    subtotal = round2(subtotal);
    if (subtotal <= 0) continue;
    out.push({ day, n, value: round2(subtotal + deliveryFor(subtotal, deliveryRule)) });
    n++;
  }
  return out;
}

/**
 * What the customer's next pack costs: the paid days still to come plus the next [PACK_DAYS], minus the balance.
 * null when nothing renews (every subscription cancelled or paused, or out of stock).
 */
export async function nextPack(customerId: number, extra: PlanSub[] = [], state?: PackState): Promise<{ amount: number; days: number } | null> {
  const st = state ?? (await packState(customerId));
  const days = await projectDays(customerId, st.daysLeft, PACK_DAYS, extra);
  const covered = days.filter((_, i) => i >= st.daysLeft).length;
  if (covered === 0) return null;
  const value = round2(days.reduce((n, d) => n + d.value, 0));
  return { amount: Math.max(0, round2(value - st.balance)), days: covered };
}

/** The date of the last delivery the customer has paid for, if any is left. */
export async function paidTill(customerId: number, state: PackState): Promise<string | null> {
  if (state.daysLeft <= 0) return null;
  const days = await projectDays(customerId, state.daysLeft, 0);
  return days.length ? days[days.length - 1].day : null;
}

/**
 * Raises the customer's next pack unless one is already on its way. A ₹0 pack (the balance covers it) is paid at
 * once. Returns the open (or just paid) pack, or null when nothing renews.
 */
export async function raisePack(customerId: number): Promise<OpenPack | null> {
  const st = await packState(customerId);
  if (st.open) return st.open;
  const next = await nextPack(customerId, [], st);
  if (!next) return null;
  try {
    return await one<OpenPack>(
      `insert into shop_charge (order_id, customer_id, mandate_id, amount, kind, days, status, paid_at)
       values (null, $1,
               (select id from shop_mandate where customer_id = $1 and status = 'authorized' order by authorized_at desc nulls last limit 1),
               $2, 'pack', $3, $4, case when $4 = 'paid' then now() end)
       returning id, status, amount::float as amount, days`,
      [customerId, next.amount, next.days, next.amount === 0 ? "paid" : "pending"],
    );
  } catch (e) {
    // another request raised one at the same moment (unique index on the open pack): that one stands
    if ((e as { code?: string }).code === "23505") return (await packState(customerId)).open;
    throw e;
  }
}

/**
 * Just before a pending pack goes to the bank: its amount again, as things stand now (a subscription added, paused
 * or cancelled since it was raised). Returns the amount and days to send, or null when it is no longer to be sent
 * (nothing renews: cancelled; or the balance covers it: paid at ₹0).
 */
export async function refreshPack(chargeId: number, customerId: number): Promise<{ amount: number; days: number } | null> {
  const st = await packState(customerId);
  const next = await nextPack(customerId, [], st);
  if (!next) {
    await query(`update shop_charge set status = 'cancelled', failure = 'Nothing to renew', updated_at = now() where id = $1 and status = 'pending'`, [chargeId]);
    return null;
  }
  if (next.amount === 0) {
    await query(`update shop_charge set status = 'paid', amount = 0, days = $2, paid_at = now(), updated_at = now() where id = $1 and status = 'pending'`, [chargeId, next.days]);
    return null;
  }
  const r = await query(`update shop_charge set amount = $2, days = $3, updated_at = now() where id = $1 and status = 'pending' returning id`, [chargeId, next.amount, next.days]);
  return r.length ? next : null;
}

/**
 * Cancelled subscriptions (renew = false) end once their paid days are used, or when nothing is paid and no pack
 * is on its way any more. Returns how many ended.
 */
export async function endFinished(customerId: number): Promise<number> {
  const subs = await query<{ id: number; ends_after_day: number | null }>(
    `select id, ends_after_day from shop_subscription where customer_id = $1 and status = 'active' and not renew`,
    [customerId],
  );
  if (!subs.length) return 0;
  const st = await packState(customerId);
  const done = subs.filter((s) => s.ends_after_day == null || st.usedDays >= s.ends_after_day || (st.daysLeft <= 0 && !st.open));
  for (const s of done) await query(`update shop_subscription set status = 'cancelled', updated_at = now() where id = $1 and status = 'active' and not renew`, [s.id]);
  return done.length;
}

/** For the Dashboard: every customer paying by packs - paid days left, balance, the pack on its way. */
export async function packCustomers() {
  return query<{ customer_id: number; customer: string; phone: string; paid_days: number; used_days: number; balance: number; open_status: string | null; open_amount: number | null; last_status: string | null; renewing: boolean }>(
    `select c.id as customer_id, c.name as customer, c.phone,
            coalesce(p.paid_days, 0)::int as paid_days, coalesce(u.used_days, 0)::int as used_days,
            round(coalesce(p.paid_amount, 0) - coalesce(u.used_amount, 0), 2)::float as balance,
            op.status as open_status, op.amount::float as open_amount, la.status as last_status,
            exists (select 1 from shop_subscription s where s.customer_id = c.id and s.status = 'active' and s.renew) as renewing
       from shop_customer c
       left join lateral (select sum(days) as paid_days, sum(amount) as paid_amount from shop_charge where customer_id = c.id and kind = 'pack' and status = 'paid') p on true
       left join lateral (select count(*) as used_days, sum(total) as used_amount from shop_order where customer_id = c.id and payment_method = 'prepaid' and status <> 'cancelled') u on true
       left join lateral (select status, amount from shop_charge where customer_id = c.id and kind = 'pack' and status = any($1) order by id desc limit 1) op on true
       left join lateral (select status from shop_charge where customer_id = c.id and kind = 'pack' order by id desc limit 1) la on true
      where exists (select 1 from shop_charge x where x.customer_id = c.id and x.kind = 'pack')
      order by c.name limit 300`,
    [OPEN],
  );
}
