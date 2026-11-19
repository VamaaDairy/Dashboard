import "server-only";
import type { PoolClient } from "pg";
import { one, query, tx } from "@/lib/db";
import { firmPrices, priceDistLines, withUnits, type DistLogin } from "@/lib/distributor";
import { unitsText, type Units } from "@/lib/distributor/packs";
import { listAllProducts } from "@/lib/shop/catalog";
import { redraftInvoice } from "@/lib/distributor/invoice";
import { syncOrderLedger } from "@/lib/books";
import { notifyStaff } from "@/lib/push";
import { tellBuyersOf, tellOfficers } from "./notify";
import { CANCELLED, CONFIRMED, decideOrder } from "./primary";

/**
 * Direct orders from the Gaia Distributors app (distributor and retailer sign-ins; a sales officer's bookings are
 * left out) are reviewed, edited and confirmed by the office on the App orders pages before they go on the route sheet.
 *
 *   Pending ──edit──▶ Pending ──confirm──▶ Confirmed ──reopen──▶ Pending
 *        └──cancel──▶ Cancelled
 *
 * Until the cutoff (20:00 IST the day before delivery) a pending app order can be changed from the apps - products added,
 * quantities up or down - by the buyer (distributor / retailer, also on an order its sales officer booked) and by the
 * sales officer (on any order of their parties, also one the buyer placed itself); the buyer can also cancel it.
 * Every step lands in dist_order_event (db/098) and the buyer's phone gets a notification for office actions.
 */

export const PENDING = "Pending";
const DIRECT = `b.app_kind in ('distributor', 'retailer')`;
/** Any order from the apps (the buyer's own or its sales officer's), not one entered on the portal. */
const APP = `b.app_kind is not null`;
/** The buyer is priced from the Retail list: a retailer's own order, or one booked for a retailer (channel RT). */
const RETAIL_BUYER = `(b.app_kind = 'retailer' or exists (select 1 from fp_firm f join fp_channel ch on ch.uid = f.channel_uid where f.uid = b.from_firm_uid and upper(ch.channel_code) = 'RT'))`;
const CUTOFF_HOUR = 20;
export const MAX_DESK_QTY = 9999;

export type Actor = { name: string; kind: "office" | "app" };
export type DeskResult = { ok: true } | { ok: false; error: string };
export type LineChange = { sku: string; name: string; from: number; to: number };

/** 20:00 IST on the day before delivery: after it, only the office can change the order. */
export function cutoffFor(deliveryDate: string): Date {
  // date arithmetic on the calendar day itself (UTC midnight), so the IST offset cannot shift it
  const d = new Date(`${deliveryDate.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return new Date(`${d.toISOString().slice(0, 10)}T${String(CUTOFF_HOUR).padStart(2, "0")}:00:00+05:30`);
}

export const todayIst = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

const isPending = (status: string) => status.toLowerCase() === "pending";

// ------------------------------------------------------------------------------------------ the day's orders

export interface DeskOrder {
  uid: string;
  orderId: number;
  placedAt: Date;
  deliveryDate: string;
  status: string;
  kind: "distributor" | "retailer";
  buyer: string;
  buyerCode: string | null;
  city: string | null;
  route: string;
  items: number;
  qty: number;
  total: number;
  edits: number;
  reason: string | null;
}

const ROUTE = `coalesce(rr.name, nullif(trim(bt.beat_name), ''), 'No route')`;
const DESK_FROM = `fp_booking_order b
  join fp_firm f on f.uid = b.from_firm_uid
  left join route_order_party rp on rp.firm_uid = f.uid
  left join route_order_route rr on rr.id = rp.route_id
  left join fp_beat bt on bt.uid = f.beat_uid`;
const DELIVERY = `coalesce(b.delivery_date, (b.booking_time at time zone 'Asia/Kolkata')::date + 1)`;

/** Direct app orders for one delivery date, grouped by route on the page. */
export async function deskOrders(date: string, opts: { status?: string; kind?: "distributor" | "retailer" } = {}): Promise<DeskOrder[]> {
  const params: unknown[] = [date];
  let extra = "";
  if (opts.status) { params.push(opts.status.toLowerCase()); extra += ` and lower(b.status) = $${params.length}`; }
  if (opts.kind) { params.push(opts.kind); extra += ` and b.app_kind = $${params.length}`; }
  return query<DeskOrder>(
    `select b.uid, b.order_id as "orderId", b.booking_time as "placedAt", ${DELIVERY}::text as "deliveryDate", b.status,
            b.app_kind as kind, f.name as buyer, f.firm_code as "buyerCode", f.city, ${ROUTE} as route,
            b.total_item::int as items, b.total_quantity::float as qty, b.total_cost::float as total,
            nullif(trim(b.rejection_reason), '') as reason,
            (select count(*)::int from dist_order_event e where e.order_uid = b.uid and e.action = 'edited') as edits
       from ${DESK_FROM}
      where ${DIRECT} and ${DELIVERY} = $1::date ${extra}
      order by ${ROUTE}, f.name, b.order_id`,
    params,
  );
}

/** How many direct orders are still pending, per delivery date (for the date picker). */
export async function pendingByDate(): Promise<Array<{ date: string; n: number }>> {
  return query(
    `select ${DELIVERY}::text as date, count(*)::int as n from fp_booking_order b
      where ${DIRECT} and lower(b.status) = 'pending' group by 1 order by 1`,
  );
}

// ------------------------------------------------------------------------------------------ one order

export interface DeskLine {
  sku: string;
  name: string;
  qty: number;
  rate: number;
  amount: number;
  /** the split as ordered, e.g. { CRT: 2, PCS: 5 }; null when by the piece only */
  units: Units | null;
}

export interface OrderEvent {
  at: Date;
  action: "placed" | "edited" | "confirmed" | "cancelled" | "reopened" | "dispatched" | "delivered" | "not_delivered";
  actor: string;
  actorKind: "office" | "app" | "transporter";
  note: string | null;
  changes: LineChange[] | null;
}

export async function orderLines(c: PoolClient | null, uid: string): Promise<DeskLine[]> {
  const sql = `select p.sku_code as sku, p.sku_name as name, i.quantity::float as qty, i.selling_price::float as rate, i.total_cost::float as amount, i.units
                 from fp_booking_order_item i join fp_product p on p.uid = i.product_uid
                where i.booking_order_uid = $1 order by i.order_item_number`;
  return c ? (await c.query<DeskLine>(sql, [uid])).rows : query<DeskLine>(sql, [uid]);
}

export async function orderEvents(uid: string): Promise<OrderEvent[]> {
  return query<OrderEvent>(
    `select at, action, actor, actor_kind as "actorKind", note, changes from dist_order_event where order_uid = $1 order by at, id`,
    [uid],
  );
}

/** What the desk needs about an order besides its lines: is it a direct one, its delivery date and cutoff. */
export async function deskMeta(uid: string): Promise<{ direct: boolean; deliveryDate: string; cutoff: Date; billed: boolean } | null> {
  const r = await one<{ direct: boolean; deliveryDate: string; billed: boolean }>(
    `select (${DIRECT}) as direct, ${DELIVERY}::text as "deliveryDate",
            exists (select 1 from route_order_bill_order x where x.order_uid = b.uid) as billed
       from fp_booking_order b where b.uid = $1`,
    [uid],
  );
  return r ? { ...r, cutoff: cutoffFor(r.deliveryDate) } : null;
}

/** Products the office can add to this order: on the buyer's app list and priced for the buyer. */
export async function orderableProducts(uid: string): Promise<Array<{ sku: string; name: string; rate: number }>> {
  const head = await one<{ firm: string; retail: boolean }>(`select from_firm_uid as firm, ${RETAIL_BUYER} as retail from fp_booking_order b where uid = $1`, [uid]);
  if (!head) return [];
  const [listed, prices] = await Promise.all([listAllProducts(head.retail ? "retail" : "distributor"), firmPrices(head.firm)]);
  const price = new Map(prices.map((p) => [p.sku, p.price]));
  return listed
    .filter((p) => (price.get(p.sku) ?? 0) > 0)
    .map((p) => ({ sku: p.sku, name: p.name, rate: price.get(p.sku)! }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ------------------------------------------------------------------------------------------ changes

const event = (c: PoolClient, uid: string, action: OrderEvent["action"], who: Actor, note?: string | null, changes?: LineChange[]) =>
  c.query(
    `insert into dist_order_event (order_uid, action, actor, actor_kind, note, changes) values ($1, $2, $3, $4, $5, $6)`,
    [uid, action, who.name, who.kind, note?.trim() ? note.trim().slice(0, 300) : null, changes ? JSON.stringify(changes) : null],
  );

/** Tells the buyer's phone(s) about an office action. Never throws. */
/** Tells the sales officer who booked the order (Gaia Salesforce app), with the party's name. */
async function tellOfficer(uid: string, title: string, body: string) {
  const o = await one<{ staff: string | null; party: string }>(
    `select b.staff_uid as staff, f.name as party from fp_booking_order b join fp_firm f on f.uid = b.from_firm_uid where b.uid = $1 and b.app_kind = 'salesman'`,
    [uid],
  );
  if (o?.staff) await notifyStaff(o.staff, { title, body: `${o.party} · ${body}`, data: { type: "order" } });
}

/** Tells the buyer: every app sign-in of its firm (also for an order a sales officer booked for it). Never throws. */
async function tellBuyer(uid: string, title: string, body: string) {
  await tellBuyersOf([uid], () => ({ title, body }));
}

const describe = (changes: LineChange[]) =>
  changes.map((ch) => (ch.from === 0 ? `+${ch.to} ${ch.name}` : ch.to === 0 ? `${ch.name} removed` : `${ch.name} ${ch.from}→${ch.to}`)).join(", ");

/**
 * Replaces a pending order's lines. lines: the whole new order, SKU → quantity in pieces (0 or missing removes it).
 * packs: how many of a line's pieces are whole crates / boxes, where the buyer said; a line left out keeps its split
 * when its quantity is unchanged, else takes as many whole packs as fit.
 * Prices are worked out again for the buyer, totals and the invoice follow, and the change is logged.
 */
export async function editOrder(uid: string, lines: Map<string, number>, who: Actor, note?: string | null, packs: Map<string, number> = new Map()): Promise<DeskResult> {
  if (!/^[0-9a-f-]{36}$/i.test(uid)) return { ok: false, error: "That order no longer exists." };
  const wanted = new Map([...lines].filter(([, q]) => q > 0));
  if (!wanted.size) return { ok: false, error: "An order needs at least one product. Cancel it instead." };
  if ([...wanted.values()].some((q) => !Number.isInteger(q) || q > MAX_DESK_QTY)) return { ok: false, error: "Check the quantities." };

  const head = await one<{ firm: string; retail: boolean; status: string }>(
    `select from_firm_uid as firm, ${RETAIL_BUYER} as retail, status from fp_booking_order b where uid = $1`,
    [uid],
  );
  if (!head) return { ok: false, error: "That order no longer exists." };
  // a retailer's order (its own, or booked for it by a sales officer) is priced from the Retail list
  const priced = await priceDistLines(head.retail ? "retail" : "distributor", head.firm, wanted);
  if (!priced.ok) return priced;

  const r = await tx(async (c): Promise<DeskResult & { changes?: LineChange[] }> => {
    const o = (await c.query<{ order_id: number; status: string }>(`select order_id, status from fp_booking_order where uid = $1 for update`, [uid])).rows[0];
    if (!o) return { ok: false, error: "That order no longer exists." };
    if (!isPending(o.status)) return { ok: false, error: `Order ${o.order_id} is ${o.status.toLowerCase()}; only a pending order can be changed.` };

    const before = await orderLines(c, uid);
    const split = await withUnits(priced.lines, packs, new Map(before.map((l) => [l.sku, { qty: l.qty, units: l.units }])));
    const names = new Map(before.map((l) => [l.sku, l.name]));
    const added = await c.query<{ sku: string; name: string }>(`select sku_code as sku, sku_name as name from fp_product where sku_code = any($1)`, [[...wanted.keys()]]);
    for (const a of added.rows) if (!names.has(a.sku)) names.set(a.sku, a.name);
    const changes: LineChange[] = [];
    for (const sku of new Set([...before.map((l) => l.sku), ...wanted.keys()])) {
      const from = before.find((l) => l.sku === sku)?.qty ?? 0;
      const to = wanted.get(sku) ?? 0;
      if (from !== to) changes.push({ sku, name: names.get(sku) ?? sku, from, to });
    }
    // only crates / boxes against loose pieces changed (same total): still saved
    const splitChanged = split.some((l) => unitsText(l.units) !== unitsText(before.find((b) => b.sku === l.sku)?.units ?? null));
    if (!changes.length && !splitChanged) return { ok: false, error: "Nothing changed." };

    await c.query(`delete from fp_booking_order_item where booking_order_uid = $1`, [uid]);
    let n = 0;
    for (const l of split) {
      await c.query(
        `insert into fp_booking_order_item (mrp, selling_price, dp, quantity, stock, total_cost, booking_order_uid, product_uid, order_item_number, units)
         values ($1, $2, $2, $3, 0, $4, $5, $6, $7, $8)`,
        [l.mrp, l.dp, l.qty, Math.round(l.qty * l.dp * 100) / 100, uid, l.uid, ++n, l.units ? JSON.stringify(l.units) : null],
      );
    }
    const qty = priced.lines.reduce((s, l) => s + l.qty, 0);
    const total = Math.round(priced.lines.reduce((s, l) => s + l.qty * l.dp, 0) * 100) / 100;
    await c.query(
      `update fp_booking_order set total_item = $2, total_quantity = $3, total_cost = $4, dealer_cost = $4, modified_time = now(), updated_at = now() where uid = $1`,
      [uid, priced.lines.length, qty, total],
    );
    await redraftInvoice(c, uid);
    await event(c, uid, "edited", who, note, changes);
    return { ok: true, changes };
  });
  if (r.ok && r.changes) {
    const o = await one<{ orderId: number }>(`select order_id as "orderId" from fp_booking_order where uid = $1`, [uid]);
    const officer = /^(.*) \(salesman\)$/.exec(who.name)?.[1];
    if (who.kind === "office") {
      await tellBuyer(uid, `Order #${o?.orderId} was changed by Gaia`, describe(r.changes));
      await tellOfficer(uid, `Order #${o?.orderId} was changed by Gaia`, describe(r.changes));
    } else if (officer) {
      // the sales officer changed it: the buyer hears what changed
      await tellBuyer(uid, `Order #${o?.orderId} was changed by Sales officer ${officer}`, describe(r.changes));
    } else {
      // the buyer changed it: the sales officer who booked it hears what changed
      await tellOfficers([uid], (x) => ({ title: `Order #${x.orderId} was changed by ${x.party}`, body: describe(r.changes!) }));
    }
  }
  return r.ok ? { ok: true } : r;
}

/** Confirms pending orders (one, or a whole route at once). Returns how many were confirmed and what failed. */
export async function confirmOrders(uids: string[], who: Actor): Promise<{ confirmed: number; errors: string[] }> {
  const out = { confirmed: 0, errors: [] as string[] };
  for (const uid of [...new Set(uids)]) {
    const r = await decideOrder(uid, "confirm", who.name);
    if (!r.ok) { out.errors.push(r.error); continue; }
    out.confirmed++;
    await tx((c) => event(c, uid, "confirmed", who));
    const o = await one<{ orderId: number; d: string }>(`select order_id as "orderId", ${DELIVERY}::text as d from fp_booking_order b where uid = $1`, [uid]);
    await tellBuyer(uid, `Order #${o?.orderId} confirmed`, `Gaia has confirmed your order for ${o?.d ?? "delivery"}.`);
    await tellOfficer(uid, `Order #${o?.orderId} confirmed`, `for ${o?.d ?? "delivery"}`);
  }
  return out;
}

/** Cancels a pending order, by the office (reason required) or by the buyer before the cutoff. */
export async function cancelOrder(uid: string, who: Actor, reason: string): Promise<DeskResult> {
  const why = reason.trim() || (who.kind === "app" ? "Cancelled by the buyer" : "");
  const r = await decideOrder(uid, "cancel", who.name, why);
  if (!r.ok) return r;
  await tx((c) => event(c, uid, "cancelled", who, why));
  const o = await one<{ orderId: number }>(`select order_id as "orderId" from fp_booking_order where uid = $1`, [uid]);
  if (who.kind === "office") {
    await tellBuyer(uid, `Order #${o?.orderId} cancelled`, why);
    await tellOfficer(uid, `Order #${o?.orderId} cancelled`, why);
  } else {
    // the buyer cancelled it: the sales officer who booked it hears
    await tellOfficers([uid], (x) => ({ title: `Order #${x.orderId} cancelled by ${x.party}`, body: why }));
  }
  return { ok: true };
}

/** Puts a confirmed order back to pending so it can be changed. Not once it is billed. */
export async function reopenOrder(uid: string, who: Actor, reason: string): Promise<DeskResult> {
  const why = reason.trim().slice(0, 300);
  if (!why) return { ok: false, error: "Give a reason for reopening." };
  const r = await tx(async (c): Promise<DeskResult> => {
    const o = (await c.query<{ order_id: number; status: string; billed: boolean }>(
      `select order_id, status, exists (select 1 from route_order_bill_order x where x.order_uid = b.uid) as billed
         from fp_booking_order b where uid = $1 for update`,
      [uid],
    )).rows[0];
    if (!o) return { ok: false, error: "That order no longer exists." };
    if (o.status !== CONFIRMED) return { ok: false, error: `Order ${o.order_id} is ${o.status.toLowerCase()}; only a confirmed order can be reopened.` };
    if (o.billed) return { ok: false, error: `Order ${o.order_id} is already billed. Cancel its bill in Route orders first.` };
    if ((await c.query(`select 1 from dist_trip_stop where order_uid = $1`, [uid])).rows.length) {
      return { ok: false, error: `Order ${o.order_id} is on a trip. Take it off the trip on the Dispatch page first.` };
    }
    await c.query(
      `update fp_booking_order set status = $2, current_status = $2, accepted_quantity = null, modified_time = now(), updated_at = now() where uid = $1`,
      [uid, PENDING],
    );
    await event(c, uid, "reopened", who, why);
    await syncOrderLedger(c, uid);
    return { ok: true };
  });
  return r;
}

// ------------------------------------------------------------------------------------------ from the app

/** Who is looking: the buyer (distributor / retailer app), or a sales officer (Salesforce app) by name. */
export type OrderViewer = { kind: "buyer" } | { kind: "salesman"; name: string };

/**
 * Who did a step, as this viewer reads it: Gaia (the office), the transporter by name, the sales officer by name, the
 * buyer by name - and "You" for the viewer's own steps. Stored app actors read "<name> (<kind>)".
 */
function actorFor(e: Pick<OrderEvent, "actor" | "actorKind">, viewer: OrderViewer): string {
  if (e.actorKind === "office") return "Gaia";
  if (e.actorKind !== "app") return e.actor;
  const m = /^(.*) \((salesman|distributor|retailer)\)$/.exec(e.actor);
  const name = m?.[1] ?? e.actor;
  if (m?.[2] === "salesman") return viewer.kind === "salesman" && viewer.name === name ? "You" : `Sales officer ${name}`;
  return viewer.kind === "buyer" ? "You" : name;
}

/**
 * What the apps show about an order beyond its lines: the delivery date, until when it may still be changed from the
 * apps (every app order, pending, before the cutoff), and its history with who did each step.
 */
export async function appOrderExtras(uids: string[], viewer: OrderViewer = { kind: "buyer" }): Promise<Map<string, { deliveryDate: string; editableUntil: string | null; history: Array<Omit<OrderEvent, "at"> & { at: string }> }>> {
  if (!uids.length) return new Map();
  const heads = await query<{ uid: string; status: string; d: string; app: boolean }>(
    `select b.uid, b.status, ${DELIVERY}::text as d, (${APP}) as app from fp_booking_order b where b.uid = any($1)`,
    [uids],
  );
  const events = await query<OrderEvent & { uid: string }>(
    `select order_uid as uid, at, action, actor, actor_kind as "actorKind", note, changes from dist_order_event where order_uid = any($1) order by at, id`,
    [uids],
  );
  const now = Date.now();
  return new Map(
    heads.map((h) => {
      const cutoff = cutoffFor(h.d);
      return [
        h.uid,
        {
          deliveryDate: h.d,
          editableUntil: h.app && isPending(h.status) && cutoff.getTime() > now ? cutoff.toISOString() : null,
          history: events
            .filter((e) => e.uid === h.uid)
            .map(({ uid: _u, at, ...e }) => ({ ...e, actor: actorFor(e, viewer), at: new Date(at).toISOString() })),
        },
      ];
    }),
  );
}

/**
 * An app order this login may change: a distributor / retailer, any of its own firm's (its own or its sales officer's);
 * a sales officer, any of their parties' (the ones they booked, and those of parties they are the sales contact of).
 */
async function appOrder(login: DistLogin, orderId: number) {
  const mine = login.kind === "salesman"
    ? (login.staffUid ? { where: "(b.staff_uid = $2 or b.from_firm_uid in (select uid from fp_firm where sales_contact_uid = $2 and active = 1))", arg: login.staffUid } : null)
    : (login.firmUid ? { where: "b.from_firm_uid = $2", arg: login.firmUid } : null);
  if (!mine) return null;
  const o = await one<{ uid: string; status: string; d: string }>(
    `select b.uid, b.status, ${DELIVERY}::text as d from fp_booking_order b where b.order_id = $1 and ${mine.where} and ${APP}`,
    [orderId, mine.arg],
  );
  if (!o) return null;
  return { ...o, open: isPending(o.status) && cutoffFor(o.d).getTime() > Date.now() };
}

const buyer = (login: DistLogin): Actor => ({ name: `${login.name} (${login.kind})`, kind: "app" });
const closed = "This order can no longer be changed from the app. Please call Gaia on 8085959595.";

export async function editOrderFromApp(login: DistLogin, orderId: number, lines: Map<string, number>, packs?: Map<string, number>): Promise<DeskResult> {
  const o = await appOrder(login, orderId);
  if (!o) return { ok: false, error: "Order not found." };
  if (!o.open) return { ok: false, error: closed };
  return editOrder(o.uid, lines, buyer(login), null, packs);
}

export async function cancelOrderFromApp(login: DistLogin, orderId: number, reason?: string): Promise<DeskResult> {
  // the buyer (or the office) cancels; a sales officer changes the order instead
  if (login.kind === "salesman") return { ok: false, error: "Only the distributor or Gaia can cancel an order." };
  const o = await appOrder(login, orderId);
  if (!o) return { ok: false, error: "Order not found." };
  if (!o.open) return { ok: false, error: closed };
  return cancelOrder(o.uid, buyer(login), reason ?? "");
}

export { CANCELLED, CONFIRMED };

// ------------------------------------------------------------------------------------------ from the route sheet

export type SheetResult = { ok: true; cancelled?: boolean } | { ok: false; error: string };

/**
 * The route sheet changes one product's quantity on one order (pieces; packs = how many of them are whole cases).
 * 0 takes the product off; an order left with nothing is cancelled. A confirmed order is reopened, changed and
 * confirmed again (each step in its history); a billed order, or one already on a trip, is not changed here.
 */
export async function setLineFromSheet(uid: string, sku: string, qty: number, who: Actor, packs: number | null = null, reason?: string | null): Promise<SheetResult> {
  const why = reason?.trim().slice(0, 200) || null;
  if (!/^[0-9a-f-]{36}$/i.test(uid)) return { ok: false, error: "That order no longer exists." };
  if (!Number.isInteger(qty) || qty < 0 || qty > MAX_DESK_QTY) return { ok: false, error: "Check the quantity." };
  const o = await one<{ orderId: number; status: string; billed: boolean; trip: boolean }>(
    `select b.order_id as "orderId", b.status,
            exists (select 1 from route_order_bill_order x where x.order_uid = b.uid) as billed,
            exists (select 1 from dist_trip_stop t where t.order_uid = b.uid) as trip
       from fp_booking_order b where b.uid = $1`,
    [uid],
  );
  if (!o) return { ok: false, error: "That order no longer exists." };
  if (/^(cancel|reject)/i.test(o.status)) return { ok: false, error: `Order ${o.orderId} is cancelled.` };
  if (o.billed) return { ok: false, error: `Order ${o.orderId} is billed. Cancel its bill first.` };
  if (o.trip) return { ok: false, error: `Order ${o.orderId} is on a trip. Take it off the trip on the Dispatch page first.` };

  const lines = new Map((await orderLines(null, uid)).map((l) => [l.sku, l.qty]));
  if ((lines.get(sku) ?? 0) === qty && packs === null) return { ok: true };
  lines.set(sku, qty);
  const left = [...lines.values()].filter((q) => q > 0).length;
  const confirmed = o.status === CONFIRMED;

  // nothing left on it: the order is cancelled instead
  if (!left) {
    if (confirmed) {
      const re = await reopenOrder(uid, who, why ?? "Last product taken off on the route sheet");
      if (!re.ok) return re;
    }
    const r = await cancelOrder(uid, who, why ?? "Its products were taken off on the route sheet");
    return r.ok ? { ok: true, cancelled: true } : r;
  }

  if (confirmed) {
    const re = await reopenOrder(uid, who, why ?? "Changed on the route sheet");
    if (!re.ok) return re;
  }
  const r = await editOrder(uid, lines, who, why ?? "Changed on the route sheet", packs === null ? new Map() : new Map([[sku, packs]]));
  if (confirmed) await confirmOrders([uid], who); // back to confirmed, changed or not
  return r.ok ? { ok: true } : r;
}

/**
 * Takes one product off every order in [uids] that has it (the route sheet's "cancel this product for the day").
 * Returns how many orders were changed, how many were cancelled (it was all they had) and what could not be done.
 */
export async function removeProductFromOrders(uids: string[], sku: string, who: Actor, reason?: string | null): Promise<{ changed: number; cancelled: number; errors: string[] }> {
  const out = { changed: 0, cancelled: 0, errors: [] as string[] };
  const having = await query<{ uid: string }>(
    `select distinct i.booking_order_uid as uid from fp_booking_order_item i join fp_product p on p.uid = i.product_uid
      where i.booking_order_uid = any($1::uuid[]) and p.sku_code = $2 and i.quantity > 0`,
    [uids, sku],
  );
  for (const h of having) {
    const r = await setLineFromSheet(h.uid, sku, 0, who, null, reason);
    if (!r.ok) out.errors.push(r.error);
    else if (r.cancelled) out.cancelled++;
    else out.changed++;
  }
  return out;
}
