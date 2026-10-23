import "server-only";
import { query, tx } from "@/lib/db";
import { notifyOrderStatus, notifySubscription } from "@/lib/push";
import { pricesFor } from "./catalog";
import { deliveryRule } from "./orders";
import { deliveryFor } from "./pricing";

/**
 * Subscriptions: a product delivered on a schedule. The plan (frequency, quantity) says what a
 * normal day looks like; shop_subscription_day overrides single days (0 = skip). The evening before
 * a day, generateOrders(day) turns everything due into one ordinary order per customer.
 *
 * Days are India dates as 'YYYY-MM-DD' strings throughout.
 */

export const FREQUENCIES = ["daily", "alternate", "weekdays", "every_n", "skip_n"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

/** Changes for tomorrow are allowed until this hour (India time) today. */
export const CUTOFF_HOUR = 21;
const MAX_QTY = 20;

export interface Subscription {
  id: number;
  customer_id: number;
  sku_code: string;
  qty: number;
  frequency: Frequency;
  weekdays: number[] | null;
  every_n: number | null;
  start_date: string;
  end_date: string | null;
  status: "active" | "paused" | "cancelled";
  name: string;
  phone: string;
  address: string;
  pincode: string | null;
  lat: number | null;
  lng: number | null;
}

const SUB_COLS = `id, customer_id, sku_code, qty, frequency, weekdays, every_n,
  to_char(start_date, 'YYYY-MM-DD') as start_date, to_char(end_date, 'YYYY-MM-DD') as end_date,
  status, name, phone, address, pincode, lat, lng`;

// ---- dates (India) ----

const ist = () => new Date(Date.now() + 5.5 * 3600_000);
export const todayIST = () => ist().toISOString().slice(0, 10);
const hourIST = () => ist().getUTCHours();
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
/** ISO weekday: 1 = Monday ... 7 = Sunday. */
const isoDow = (day: string) => ((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
const isDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/** The first day that can still be changed: tomorrow until 9 PM, the day after once it's past. */
export const firstEditableDay = () => addDays(todayIST(), hourIST() < CUTOFF_HOUR ? 1 : 2);
export const canChange = (day: string) => day >= firstEditableDay();

/** Is this subscription due on [day] by its plan (before any per-day change)? */
export function planned(s: Pick<Subscription, "frequency" | "weekdays" | "every_n" | "start_date" | "end_date" | "status">, day: string): boolean {
  if (s.status !== "active" || day < s.start_date || (s.end_date && day > s.end_date)) return false;
  const since = daysBetween(s.start_date, day);
  switch (s.frequency) {
    case "daily":
      return true;
    case "alternate":
      return since % 2 === 0;
    case "every_n":
      return since % (s.every_n ?? 1) === 0;
    case "skip_n": // every day except every Nth one (the Nth, 2Nth, ... day from the start)
      return (since + 1) % (s.every_n ?? 1) !== 0;
    case "weekdays":
      return (s.weekdays ?? []).includes(isoDow(day));
  }
}

// ---- input ----

export interface PlanInput {
  sku: string;
  qty: number;
  frequency: Frequency;
  weekdays: number[] | null;
  everyN: number | null;
  startDate: string;
  endDate: string | null;
}

/** Checks a plan from the app; returns the clean plan or the message to show. */
export function parsePlan(b: Record<string, unknown>, partial = false): { ok: true; plan: Partial<PlanInput> } | { ok: false; error: string } {
  const plan: Partial<PlanInput> = {};
  if (!partial || b.sku !== undefined) {
    if (typeof b.sku !== "string" || !b.sku) return { ok: false, error: "Choose a product." };
    plan.sku = b.sku;
  }
  if (!partial || b.qty !== undefined) {
    const q = Number(b.qty);
    if (!Number.isInteger(q) || q < 1 || q > MAX_QTY) return { ok: false, error: `Quantity must be 1 to ${MAX_QTY}.` };
    plan.qty = q;
  }
  if (!partial || b.frequency !== undefined) {
    if (!FREQUENCIES.includes(b.frequency as Frequency)) return { ok: false, error: "Choose how often." };
    plan.frequency = b.frequency as Frequency;
    plan.weekdays = null;
    plan.everyN = null;
    if (plan.frequency === "weekdays") {
      const w = Array.isArray(b.weekdays) ? [...new Set(b.weekdays.map(Number))].filter((x) => Number.isInteger(x) && x >= 1 && x <= 7).sort() : [];
      if (!w.length) return { ok: false, error: "Pick at least one day of the week." };
      plan.weekdays = w;
    }
    if (plan.frequency === "every_n" || plan.frequency === "skip_n") {
      const n = Number(b.everyN);
      if (!Number.isInteger(n) || n < 2 || n > 30) return { ok: false, error: "Every N days must be 2 to 30." };
      plan.everyN = n;
    }
  }
  if (!partial || b.startDate !== undefined) {
    if (!isDay(b.startDate)) return { ok: false, error: "Choose a start date." };
    if (!canChange(b.startDate)) return { ok: false, error: `The earliest start is ${firstEditableDay()} (changes close at 9 PM the day before).` };
    plan.startDate = b.startDate;
  }
  if (b.endDate !== undefined) {
    if (b.endDate !== null && !isDay(b.endDate)) return { ok: false, error: "That end date is not valid." };
    plan.endDate = (b.endDate as string | null) ?? null;
  }
  return { ok: true, plan };
}

// ---- reading ----

export interface CalendarItem { subscriptionId: number; sku: string; name: string; image: string | null; qty: number; planQty: number; changed: boolean }
export interface CalendarDay {
  day: string;
  items: CalendarItem[];
  /** planned: as the plan says; changed: a day edited by the customer; skipped: nothing that day;
   *  ordered: already turned into an order (see orderNo / orderStatus). */
  state: "planned" | "changed" | "skipped" | "ordered" | "none";
  editable: boolean;
  orderNo?: string;
  orderStatus?: string;
  accessKey?: string;
}

/** The customer's subscriptions and a day-by-day calendar from [from] for [count] days. */
export async function customerCalendar(customerId: number, from: string, count: number) {
  const subs = await query<Subscription>(`select ${SUB_COLS} from shop_subscription where customer_id = $1 and status <> 'cancelled' order by id`, [customerId]);
  const to = addDays(from, count - 1);
  const overrides = await query<{ subscription_id: number; day: string; qty: number }>(
    `select d.subscription_id, to_char(d.day, 'YYYY-MM-DD') as day, d.qty from shop_subscription_day d
      join shop_subscription s on s.id = d.subscription_id
     where s.customer_id = $1 and d.day between $2 and $3`,
    [customerId, from, to],
  );
  const orders = await query<{ day: string; order_no: string; status: string; access_key: string }>(
    `select to_char(subscription_day, 'YYYY-MM-DD') as day, order_no, status, access_key from shop_order
      where customer_id = $1 and subscription_day between $2 and $3`,
    [customerId, from, to],
  );
  const products = await pricesFor([...new Set(subs.map((s) => s.sku_code))]);
  const over = new Map(overrides.map((o) => [`${o.subscription_id}|${o.day}`, o.qty]));
  const ordered = new Map(orders.map((o) => [o.day, o]));

  const days: CalendarDay[] = [];
  for (let i = 0; i < count; i++) {
    const day = addDays(from, i);
    const items: CalendarItem[] = [];
    let anyPlanned = false, anyChanged = false;
    for (const s of subs) {
      const plan = planned(s, day) ? s.qty : 0;
      const o = over.get(`${s.id}|${day}`);
      const qty = s.status === "active" && day >= s.start_date && (!s.end_date || day <= s.end_date) && o !== undefined ? o : plan;
      if (plan > 0) anyPlanned = true;
      if (o !== undefined && o !== plan && s.status === "active") anyChanged = true;
      if (qty > 0 || plan > 0) {
        const p = products.get(s.sku_code);
        items.push({ subscriptionId: s.id, sku: s.sku_code, name: p?.name ?? s.sku_code, image: p?.image ?? null, qty, planQty: plan, changed: o !== undefined && o !== plan });
      }
    }
    const o = ordered.get(day);
    const total = items.reduce((n, it) => n + it.qty, 0);
    days.push({
      day,
      items,
      state: o ? "ordered" : total > 0 ? (anyChanged ? "changed" : "planned") : anyPlanned || anyChanged ? "skipped" : "none",
      editable: !o && canChange(day),
      ...(o ? { orderNo: o.order_no, orderStatus: o.status, accessKey: o.access_key } : {}),
    });
  }

  return {
    today: todayIST(),
    firstEditableDay: firstEditableDay(),
    cutoffHour: CUTOFF_HOUR,
    subscriptions: subs.map((s) => {
      const p = products.get(s.sku_code);
      return {
        id: s.id, sku: s.sku_code, name: p?.name ?? s.sku_code, image: p?.image ?? null, price: p?.price ?? null, size: p?.size ?? null,
        qty: s.qty, frequency: s.frequency, weekdays: s.weekdays ?? [], everyN: s.every_n, startDate: s.start_date, endDate: s.end_date, status: s.status,
      };
    }),
    days,
  };
}

// ---- changing ----

export async function createSubscription(
  customerId: number,
  plan: PlanInput,
  to: { name: string; phone: string; address: string; pincode: string | null; lat: number | null; lng: number | null },
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  if (!(await pricesFor([plan.sku])).has(plan.sku)) return { ok: false, error: "That product is not available." };
  const [row] = await query<{ id: number }>(
    `insert into shop_subscription (customer_id, sku_code, qty, frequency, weekdays, every_n, start_date, end_date, name, phone, address, pincode, lat, lng)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) returning id`,
    [customerId, plan.sku, plan.qty, plan.frequency, plan.weekdays, plan.everyN, plan.startDate, plan.endDate, to.name, to.phone, to.address, to.pincode, to.lat, to.lng],
  );
  await notifySubscription(customerId, "created");
  return { ok: true, id: row.id };
}

export async function updateSubscription(
  customerId: number,
  id: number,
  patch: Partial<PlanInput> & { status?: "active" | "paused" | "cancelled" },
): Promise<boolean> {
  const sets: string[] = [];
  const vals: unknown[] = [id, customerId];
  const put = (col: string, v: unknown) => {
    vals.push(v);
    sets.push(`${col} = $${vals.length}`);
  };
  if (patch.qty !== undefined) put("qty", patch.qty);
  if (patch.frequency !== undefined) {
    put("frequency", patch.frequency);
    put("weekdays", patch.weekdays ?? null);
    put("every_n", patch.everyN ?? null);
  }
  if (patch.startDate !== undefined) put("start_date", patch.startDate);
  if (patch.endDate !== undefined) put("end_date", patch.endDate);
  if (patch.status !== undefined) put("status", patch.status);
  if (!sets.length) return true;
  const r = await query(`update shop_subscription set ${sets.join(", ")}, updated_at = now() where id = $1 and customer_id = $2 and status <> 'cancelled' returning id`, vals);
  if (r.length > 0 && patch.status) await notifySubscription(customerId, patch.status === "active" ? "resumed" : patch.status);
  return r.length > 0;
}

/** One day differently: [qty] 0 skips it, null goes back to the plan. */
export async function setDay(customerId: number, id: number, day: string, qty: number | null): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isDay(day)) return { ok: false, error: "That date is not valid." };
  if (!canChange(day)) return { ok: false, error: "This day can no longer be changed (changes close at 9 PM the day before)." };
  if (qty !== null && (!Number.isInteger(qty) || qty < 0 || qty > MAX_QTY)) return { ok: false, error: `Quantity must be 0 to ${MAX_QTY}.` };
  const [s] = await query<{ id: number }>(`select id from shop_subscription where id = $1 and customer_id = $2 and status <> 'cancelled'`, [id, customerId]);
  if (!s) return { ok: false, error: "That subscription no longer exists." };
  if (qty === null) await query(`delete from shop_subscription_day where subscription_id = $1 and day = $2`, [id, day]);
  else
    await query(
      `insert into shop_subscription_day (subscription_id, day, qty) values ($1, $2, $3)
       on conflict (subscription_id, day) do update set qty = excluded.qty`,
      [id, day, qty],
    );
  return { ok: true };
}

/** Vacation: skip every subscription from [from] to [to] (inclusive); [skip] false brings the days back. */
export async function setVacation(customerId: number, from: string, to: string, skip: boolean): Promise<{ ok: true; days: number } | { ok: false; error: string }> {
  if (!isDay(from) || !isDay(to) || to < from) return { ok: false, error: "Choose the first and last day of your vacation." };
  if (daysBetween(from, to) > 90) return { ok: false, error: "A vacation can be at most 90 days." };
  const start = from < firstEditableDay() ? firstEditableDay() : from;
  if (start > to) return { ok: false, error: "These days can no longer be changed (changes close at 9 PM the day before)." };
  let n = 0;
  for (let d = start; d <= to; d = addDays(d, 1)) {
    const r = await setWholeDay(customerId, d, skip);
    if (!r.ok) return r;
    n++;
  }
  return { ok: true, days: n };
}

/** Skip (or bring back) everything on one day, for all of the customer's subscriptions. */
export async function setWholeDay(customerId: number, day: string, skip: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isDay(day)) return { ok: false, error: "That date is not valid." };
  if (!canChange(day)) return { ok: false, error: "This day can no longer be changed (changes close at 9 PM the day before)." };
  const subs = await query<{ id: number }>(`select id from shop_subscription where customer_id = $1 and status = 'active'`, [customerId]);
  for (const s of subs) {
    if (skip)
      await query(
        `insert into shop_subscription_day (subscription_id, day, qty) values ($1, $2, 0) on conflict (subscription_id, day) do update set qty = 0`,
        [s.id, day],
      );
    else await query(`delete from shop_subscription_day where subscription_id = $1 and day = $2`, [s.id, day]);
  }
  return { ok: true };
}

// ---- turning a day into orders ----

/**
 * Creates the orders for [day]: one per customer with anything due, priced at today's prices.
 * Safe to run more than once - a customer who already has that day's order is left alone.
 */
export async function generateOrders(day: string): Promise<{ created: number; items: number; skipped: number }> {
  const subs = await query<Subscription>(
    `select ${SUB_COLS} from shop_subscription s
      where status = 'active' and start_date <= $1 and (end_date is null or end_date >= $1)
        and not exists (select 1 from shop_order o where o.customer_id = s.customer_id and o.subscription_day = $1)
      order by customer_id, id`,
    [day],
  );
  if (!subs.length) return { created: 0, items: 0, skipped: 0 };
  const overrides = await query<{ subscription_id: number; qty: number }>(
    `select subscription_id, qty from shop_subscription_day where day = $1 and subscription_id = any($2)`,
    [day, subs.map((s) => s.id)],
  );
  const over = new Map(overrides.map((o) => [o.subscription_id, o.qty]));
  const prices = await pricesFor([...new Set(subs.map((s) => s.sku_code))]);

  const byCustomer = new Map<number, { sub: Subscription; qty: number }[]>();
  let skipped = 0;
  for (const s of subs) {
    const qty = over.get(s.id) ?? (planned(s, day) ? s.qty : 0);
    if (qty <= 0) {
      if (planned(s, day)) skipped++;
      continue;
    }
    if (!prices.has(s.sku_code)) continue; // no longer sold
    byCustomer.set(s.customer_id, [...(byCustomer.get(s.customer_id) ?? []), { sub: s, qty }]);
  }

  let created = 0, items = 0;
  for (const [customerId, lines] of byCustomer) {
    const to = lines[lines.length - 1].sub; // the newest subscription's address
    const rows = lines.map(({ sub, qty }) => {
      const p = prices.get(sub.sku_code)!;
      return { sku: sub.sku_code, name: p.name, image: p.image, qty, unit: p.price, total: Math.round(p.price * qty * 100) / 100 };
    });
    const subtotal = Math.round(rows.reduce((n, r) => n + r.total, 0) * 100) / 100;
    const fee = deliveryFor(subtotal, deliveryRule);
    const made = await tx(async (c) => {
      const o = await c.query(
        `insert into shop_order (name, phone, address, pincode, notes, lat, lng, subtotal, delivery_fee, total, status, customer_id, subscription_day)
         values ($1, $2, $3, $4, 'Subscription delivery', $5, $6, $7, $8, $9, 'confirmed', $10, $11)
         on conflict do nothing returning id`,
        [to.name, to.phone, to.address, to.pincode, to.lat, to.lng, subtotal, fee, subtotal + fee, customerId, day],
      );
      if (!o.rows.length) return 0;
      for (const r of rows) {
        await c.query(
          `insert into shop_order_item (order_id, sku_code, name, image_url, qty, unit_price, line_total) values ($1, $2, $3, $4, $5, $6, $7)`,
          [o.rows[0].id, r.sku, r.name, r.image, r.qty, r.unit, r.total],
        );
      }
      return o.rows[0].id as number;
    });
    if (made) {
      await notifyOrderStatus(made, "subscription");
      created++;
      items += rows.reduce((n, r) => n + r.qty, 0);
    }
  }
  return { created, items, skipped };
}

// ---- for the dashboard ----

/** What [day] holds across all customers, before or after its orders exist. */
export async function daySummary(day: string): Promise<{ customers: number; items: number; skipped: number; ordered: number }> {
  const subs = await query<Subscription>(
    `select ${SUB_COLS} from shop_subscription where status = 'active' and start_date <= $1 and (end_date is null or end_date >= $1)`,
    [day],
  );
  const over = new Map(
    (await query<{ subscription_id: number; qty: number }>(`select subscription_id, qty from shop_subscription_day where day = $1`, [day])).map((o) => [o.subscription_id, o.qty]),
  );
  const who = new Set<number>();
  let items = 0, skipped = 0;
  for (const s of subs) {
    const qty = over.get(s.id) ?? (planned(s, day) ? s.qty : 0);
    if (qty > 0) {
      who.add(s.customer_id);
      items += qty;
    } else if (planned(s, day)) skipped++;
  }
  const [o] = await query<{ n: number }>(`select count(*)::int as n from shop_order where subscription_day = $1`, [day]);
  return { customers: who.size, items, skipped, ordered: o.n };
}

export interface SubscriptionRow {
  id: number; customer: string; phone: string; product: string; qty: number; frequency: Frequency;
  weekdays: number[] | null; every_n: number | null; start_date: string; end_date: string | null; status: string; address: string;
}

export async function allSubscriptions(): Promise<SubscriptionRow[]> {
  const rows = await query<SubscriptionRow & { sku_code: string }>(
    `select s.id, c.name as customer, c.phone, s.sku_code, s.sku_code as product, s.qty, s.frequency, s.weekdays, s.every_n,
            to_char(s.start_date, 'YYYY-MM-DD') as start_date, to_char(s.end_date, 'YYYY-MM-DD') as end_date, s.status, s.address
       from shop_subscription s join shop_customer c on c.id = s.customer_id
      where s.status <> 'cancelled'
      order by s.status, c.name, s.id`,
  );
  const names = await pricesFor([...new Set(rows.map((r) => r.sku_code))]);
  return rows.map((r) => ({ ...r, product: names.get(r.sku_code)?.name ?? r.sku_code }));
}

const WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export function frequencyLabel(f: Frequency, weekdays: number[] | null, n: number | null): string {
  switch (f) {
    case "daily": return "Daily";
    case "alternate": return "Alternate days";
    case "weekdays": return (weekdays ?? []).map((d) => WD[d - 1]).join(", ");
    case "every_n": return `Every ${n} days`;
    case "skip_n": return `Daily, not every ${n}th day`;
  }
}
