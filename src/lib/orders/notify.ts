import "server-only";
import { query } from "@/lib/db";
import { notifyStaff, pushToRole } from "@/lib/push";

/**
 * Who hears about a trade order's steps: every app sign-in of the buyer's firm (Gaia Distributors app - distributor or
 * retailer, whoever placed the order, also one a sales officer booked), and the sales officer who booked it (Gaia
 * Salesforce app). Never throws: a failed notification must not fail the step behind it.
 */
export type OrderNote = { title: string; body: string };

interface Head { uid: string; orderId: number; firm: string; party: string; kind: string | null; staff: string | null }

async function heads(uids: string[]): Promise<Head[]> {
  if (!uids.length) return [];
  return query<Head>(
    `select b.uid, b.order_id as "orderId", b.from_firm_uid as firm, f.name as party, b.app_kind as kind, b.staff_uid as staff
       from fp_booking_order b join fp_firm f on f.uid = b.from_firm_uid where b.uid = any($1::uuid[])`,
    [uids],
  );
}

/**
 * Tells each order's buyer (every live app sign-in of its firm) and, unless `officer` is false, the sales officer who
 * booked it. `note` makes the words per order (null: nothing to say for that one).
 */
export async function tellOrders(
  uids: string[],
  note: (o: { uid: string; orderId: number; party: string }) => OrderNote | null,
  opts: { buyer?: boolean; officer?: boolean } = {},
): Promise<void> {
  try {
    const list = await heads([...new Set(uids)]);
    if (!list.length) return;
    const logins = opts.buyer === false ? [] : await query<{ id: number; firm: string; kind: "distributor" | "retailer" }>(
      `select id, firm_uid as firm, kind from dist_login where firm_uid = any($1::uuid[]) and active and kind in ('distributor', 'retailer')`,
      [list.map((o) => o.firm)],
    );
    for (const o of list) {
      const n = note(o);
      if (!n) continue;
      const data = { type: "order", orderId: String(o.orderId) };
      for (const l of logins.filter((x) => x.firm === o.firm)) {
        await pushToRole("distributor", l.id, { ...n, data }, l.kind).catch(() => null);
      }
      if (opts.officer !== false && o.kind === "salesman" && o.staff) {
        await notifyStaff(o.staff, { title: n.title, body: `${o.party} · ${n.body}`, data: { type: "order" } });
      }
    }
  } catch (e) {
    console.error("[push] order notify failed:", e);
  }
}

/** Only the sales officer who booked these orders (the buyer itself acted). */
export const tellOfficers = (uids: string[], note: (o: { uid: string; orderId: number; party: string }) => OrderNote | null) =>
  tellOrders(uids, note, { buyer: false });

/** Only the buyer (the sales officer acted, or the step is the buyer's alone). */
export const tellBuyersOf = (uids: string[], note: (o: { uid: string; orderId: number; party: string }) => OrderNote | null) =>
  tellOrders(uids, note, { officer: false });
