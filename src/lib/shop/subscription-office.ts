import "server-only";
import { one, query } from "@/lib/db";
import { notify, notifySubscription } from "@/lib/push";
import { parsePlan, setDay, setVacation, updateSubscription } from "./subscriptions";

/**
 * The office changing a customer's subscription from the Dashboard (Shop orders > Subscriptions): the plan, pause /
 * resume / cancel, a vacation, or one day's quantity. Same rules as the app (changes close at 9 PM the day before),
 * every change goes into master_audit, and the customer's phone gets a notification.
 */

type Result = { ok: true; message?: string } | { ok: false; error: string };

const audit = (who: string, id: number | string, summary: string) =>
  query(`insert into master_audit (actor, slug, record_id, action, summary) values ($1, 'shopSubscription', $2, 'update', $3)`, [who, String(id), summary]);

async function owns(customerId: number, id: number) {
  return one<{ sku: string }>(`select sku_code as sku from shop_subscription where id = $1 and customer_id = $2 and status <> 'cancelled'`, [id, customerId]);
}

/** Changes the plan: product, quantity, how often, start (future only) and end date. Body fields as the app sends them. */
export async function officeUpdatePlan(who: string, customerId: number, id: number, body: Record<string, unknown>): Promise<Result> {
  if (!(await owns(customerId, id))) return { ok: false, error: "That subscription no longer exists." };
  const p = parsePlan(body, true);
  if (!p.ok) return p;
  if (!Object.keys(p.plan).length) return { ok: false, error: "Nothing changed." };
  const ok = await updateSubscription(customerId, id, p.plan);
  if (!ok) return { ok: false, error: "Could not save. The product may not be on sale in the app." };
  await audit(who, id, `Plan changed for customer ${customerId}: ${JSON.stringify(p.plan)}`);
  await notifySubscription(customerId, "updated");
  return { ok: true, message: "Saved. Days from the next open day follow the new plan." };
}

export async function officeSetStatus(who: string, customerId: number, id: number, status: "active" | "paused" | "cancelled"): Promise<Result> {
  if (!(await owns(customerId, id))) return { ok: false, error: "That subscription no longer exists." };
  // the office's cancel is at once (a customer's own runs to the end of what they paid)
  if (!(await updateSubscription(customerId, id, { status }, { immediate: true }))) return { ok: false, error: "Could not change the status." };
  await audit(who, id, `Subscription ${status === "active" ? "resumed" : status} for customer ${customerId}`);
  return { ok: true };
}

/** Skips (or brings back) every subscription of the customer from [from] to [to]. */
export async function officeVacation(who: string, customerId: number, from: string, to: string, skip: boolean): Promise<Result> {
  const r = await setVacation(customerId, from, to, skip);
  if (!r.ok) return r;
  await audit(who, customerId, `${skip ? "Vacation" : "Vacation removed"} ${from} to ${to} (${r.days} day${r.days === 1 ? "" : "s"}) for customer ${customerId}`);
  await notify("customer", customerId, {
    title: skip ? "Deliveries paused for your vacation" : "Deliveries are back on",
    body: skip ? `No deliveries from ${from} to ${to}. Gaia set this for you.` : `Your deliveries from ${from} to ${to} are back on.`,
    data: { type: "subscription", event: "vacation" },
  });
  return { ok: true, message: `${r.days} day${r.days === 1 ? "" : "s"} ${skip ? "skipped" : "brought back"}.` };
}

/** One day differently for one subscription: qty 0 skips it, null goes back to the plan. */
export async function officeSetDay(who: string, customerId: number, id: number, day: string, qty: number | null): Promise<Result> {
  const r = await setDay(customerId, id, day, qty);
  if (!r.ok) return r;
  await audit(who, id, `Day ${day} set to ${qty === null ? "the plan" : qty === 0 ? "skip" : `${qty}`} for customer ${customerId}`);
  await notify("customer", customerId, {
    title: "Delivery changed",
    body: qty === 0 ? `Your delivery on ${day} is skipped.` : qty === null ? `Your delivery on ${day} is back to your plan.` : `Your delivery on ${day} is now ${qty}.`,
    data: { type: "subscription", event: "day" },
  });
  return { ok: true };
}
