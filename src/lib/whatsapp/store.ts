import "server-only";
import { one, query, tx } from "@/lib/db";
import { shop } from "./config";
import type { OrderStatus, PaymentStatus } from "./statuses";
import { fetchCatalogProducts, resolveCatalogId, sendMessage, type CatalogProduct, type OutPayload } from "./graph";

// ================================================================= types

export { ORDER_STATUSES, PAYMENT_STATUSES, type OrderStatus, type PaymentStatus } from "./statuses";

export interface Contact {
  wa_id: string;
  name: string | null;
  bot_enabled: boolean;
  needs_human: boolean;
  unread: number;
  cart: CartLine[];
  delivery_name: string | null;
  delivery_address: string | null;
  pending_review_order_id: number | null;
  last_message_at: string | null;
  last_inbound_at: string | null;
}

export interface CartLine {
  retailer_id: string;
  qty: number;
}

export interface Product {
  retailer_id: string;
  name: string;
  description: string;
  price: number | null;
  price_text: string | null;
  currency: string;
  image_url: string | null;
  url: string | null;
  availability: string | null;
  active: boolean;
  synced_at: string;
}

export interface Message {
  id: number;
  wa_message_id: string | null;
  wa_id: string;
  direction: "in" | "out";
  sender: "customer" | "bot" | "agent" | "system";
  type: string;
  body: string | null;
  media_id: number | null;
  media_mime: string | null;
  payload: Record<string, unknown> | null;
  status: string | null;
  error: string | null;
  order_id: number | null;
  created_at: string;
}


export interface Order {
  id: number;
  order_no: string;
  wa_id: string;
  customer_name: string | null;
  status: OrderStatus;
  payment_method: "upi" | "cod" | "link";
  payment_status: PaymentStatus;
  payment_link: string | null;
  payment_ref: string | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  currency: string;
  delivery_name: string | null;
  delivery_address: string | null;
  notes: string | null;
  source: "chat" | "catalog";
  created_at: string;
  updated_at: string;
  item_count: number;
  review_rating: number | null;
}

export interface OrderItem {
  retailer_id: string;
  name: string;
  image_url: string | null;
  qty: number;
  unit_price: number;
  line_total: number;
}

// ================================================================= contacts

export async function upsertContact(waId: string, name?: string | null): Promise<Contact> {
  const row = await one<Contact>(
    `insert into wa_contact (wa_id, name) values ($1, $2)
     on conflict (wa_id) do update set name = coalesce(excluded.name, wa_contact.name)
     returning *`,
    [waId, name ?? null],
  );
  return row!;
}

export const getContact = (waId: string) => one<Contact>(`select * from wa_contact where wa_id = $1`, [waId]);

export async function updateContact(waId: string, patch: Partial<Omit<Contact, "wa_id">>) {
  const keys = Object.keys(patch) as (keyof typeof patch)[];
  if (!keys.length) return;
  const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");
  const values = keys.map((k) => (k === "cart" ? JSON.stringify(patch[k]) : patch[k]));
  await query(`update wa_contact set ${sets} where wa_id = $1`, [waId, ...values]);
}

export interface ConversationRow {
  wa_id: string;
  name: string | null;
  bot_enabled: boolean;
  needs_human: boolean;
  unread: number;
  last_message_at: string | null;
  last_body: string | null;
  last_type: string | null;
  last_direction: string | null;
  open_orders: number;
}

export function listConversations(search = "") {
  return query<ConversationRow>(
    `select c.wa_id, c.name, c.bot_enabled, c.needs_human, c.unread, c.last_message_at,
            m.body as last_body, m.type as last_type, m.direction as last_direction,
            (select count(*)::int from wa_order o
              where o.wa_id = c.wa_id and o.status not in ('delivered','cancelled')) as open_orders
       from wa_contact c
       left join lateral (
         select body, type, direction from wa_message
          where wa_id = c.wa_id order by created_at desc, id desc limit 1
       ) m on true
      where $1 = '' or c.wa_id ilike '%' || $1 || '%' or c.name ilike '%' || $1 || '%'
      order by c.needs_human desc, c.last_message_at desc nulls last
      limit 300`,
    [search.trim()],
  );
}

// ================================================================= messages

const MESSAGE_COLS = `m.id, m.wa_message_id, m.wa_id, m.direction, m.sender, m.type, m.body, m.media_id,
  md.mime as media_mime, m.payload, m.status, m.error, m.order_id, m.created_at`;

export function getMessages(waId: string, limit = 200) {
  return query<Message>(
    `select * from (
       select ${MESSAGE_COLS} from wa_message m left join wa_media md on md.id = m.media_id
        where m.wa_id = $1 order by m.created_at desc, m.id desc limit $2
     ) t order by created_at, id`,
    [waId, limit],
  );
}

export function getOrderMedia(orderId: number) {
  return query<Message>(
    `select ${MESSAGE_COLS} from wa_message m join wa_media md on md.id = m.media_id
      where m.order_id = $1 order by m.created_at`,
    [orderId],
  );
}

/** Records an incoming message once - Meta retries webhooks, so a repeat returns null. */
export async function recordInbound(m: {
  wamid: string;
  waId: string;
  type: string;
  body: string | null;
  mediaId?: number | null;
  payload?: unknown;
  orderId?: number | null;
}): Promise<number | null> {
  const row = await one<{ id: number }>(
    `insert into wa_message (wa_message_id, wa_id, direction, sender, type, body, media_id, payload, order_id)
     values ($1, $2, 'in', 'customer', $3, $4, $5, $6, $7)
     on conflict (wa_message_id) do nothing
     returning id`,
    [m.wamid, m.waId, m.type, m.body, m.mediaId ?? null, m.payload ? JSON.stringify(m.payload) : null, m.orderId ?? null],
  );
  if (row) {
    await query(
      `update wa_contact set unread = unread + 1, last_message_at = now(), last_inbound_at = now() where wa_id = $1`,
      [m.waId],
    );
  }
  return row?.id ?? null;
}

export async function claimInboundForOrder(waId: string, messageIds: number[], orderId: number) {
  if (!messageIds.length) return;
  await query(`update wa_message set order_id = $3 where wa_id = $1 and id = any($2) and order_id is null`, [waId, messageIds, orderId]);
}

/**
 * Sends a message and keeps it in the conversation, whether WhatsApp takes it
 * or not - a failure shows in the chat with Meta's reason.
 */
export async function send(
  waId: string,
  payload: OutPayload,
  opts: { sender: "bot" | "agent" | "system"; body?: string; mediaId?: number | null; orderId?: number | null } ,
): Promise<{ ok: boolean; error?: string }> {
  const body =
    opts.body ??
    (payload.type === "text"
      ? payload.text.body
      : payload.type === "image"
        ? (payload.image.caption ?? "")
        : payload.type === "document"
          ? (payload.document.caption ?? payload.document.filename ?? "")
          : interactiveText(payload.interactive));
  const row = await one<{ id: number }>(
    `insert into wa_message (wa_id, direction, sender, type, body, media_id, payload, status, order_id)
     values ($1, 'out', $2, $3, $4, $5, $6, 'sending', $7) returning id`,
    [waId, opts.sender, payload.type, body, opts.mediaId ?? null, JSON.stringify(payload), opts.orderId ?? null],
  );
  await query(`update wa_contact set last_message_at = now() where wa_id = $1`, [waId]);
  try {
    const wamid = await sendMessage(waId, payload);
    await query(`update wa_message set wa_message_id = $2, status = 'sent' where id = $1`, [row!.id, wamid]);
    return { ok: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await query(`update wa_message set status = 'failed', error = $2 where id = $1`, [row!.id, error]);
    return { ok: false, error };
  }
}

export const sendText = (waId: string, text: string, sender: "bot" | "agent" | "system" = "bot", orderId?: number | null) =>
  send(waId, { type: "text", text: { body: text.slice(0, 4096), preview_url: true } }, { sender, orderId });

function interactiveText(i: Record<string, unknown>): string {
  const body = (i.body as { text?: string } | undefined)?.text ?? "";
  return body || `[${String(i.type ?? "interactive")}]`;
}

/** Delivery receipts from the webhook. Never moves a message backwards (read -> delivered). */
export async function applyStatus(wamid: string, status: string, error?: string | null) {
  const rank = `case $2 when 'sent' then 1 when 'delivered' then 2 when 'read' then 3 when 'failed' then 4 else 0 end`;
  await query(
    `update wa_message set status = $2, error = coalesce($3, error)
      where wa_message_id = $1
        and ${rank} > case status when 'sent' then 1 when 'delivered' then 2 when 'read' then 3 when 'failed' then 4 else 0 end`,
    [wamid, status, error ?? null],
  );
}

// ================================================================= media

export async function saveMedia(m: { metaMediaId?: string | null; mime: string; filename?: string | null; bytes: Buffer }) {
  const row = await one<{ id: number }>(
    `insert into wa_media (meta_media_id, mime, filename, bytes, size) values ($1, $2, $3, $4, $5)
     on conflict (meta_media_id) do update set mime = excluded.mime
     returning id`,
    [m.metaMediaId ?? null, m.mime, m.filename ?? null, m.bytes, m.bytes.length],
  );
  return row!.id;
}

export const getMedia = (id: number) =>
  one<{ mime: string; filename: string | null; bytes: Buffer }>(`select mime, filename, bytes from wa_media where id = $1`, [id]);

// ================================================================= products

export function parsePrice(s?: string | null): number | null {
  if (!s) return null;
  const n = Number(s.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && s.match(/\d/) ? n : null;
}

/** Copies the WhatsApp catalog into wa_product. Products gone from the catalog are kept but marked inactive. */
export async function syncCatalog(): Promise<{ count: number; catalogId: string }> {
  const catalogId = await resolveCatalogId();
  const items = await fetchCatalogProducts(catalogId);
  await tx(async (c) => {
    const seen: string[] = [];
    for (const p of items as CatalogProduct[]) {
      const rid = p.retailer_id || p.id;
      seen.push(rid);
      const regular = parsePrice(p.price);
      const sale = parsePrice(p.sale_price);
      const price = sale !== null && sale > 0 && (regular === null || sale < regular) ? sale : regular;
      await c.query(
        `insert into wa_product (retailer_id, meta_id, name, description, price, price_text, currency,
                                 image_url, url, availability, active, raw, synced_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now())
         on conflict (retailer_id) do update set
           meta_id = excluded.meta_id, name = excluded.name, description = excluded.description,
           price = excluded.price, price_text = excluded.price_text, currency = excluded.currency,
           image_url = excluded.image_url, url = excluded.url, availability = excluded.availability,
           active = excluded.active, raw = excluded.raw, synced_at = now()`,
        [
          rid, p.id, p.name ?? rid, p.description ?? "", price,
          sale !== null && price === sale ? p.sale_price : p.price ?? null,
          p.currency || "INR", p.image_url ?? null, p.url ?? null, p.availability ?? null,
          p.visibility !== "staging", JSON.stringify(p),
        ],
      );
    }
    await c.query(`update wa_product set active = false where not (retailer_id = any($1))`, [seen]);
    await c.query(
      `insert into wa_setting (key, value, updated_at) values ('catalog_synced_at', now()::text, now())
       on conflict (key) do update set value = excluded.value, updated_at = now()`,
    );
  });
  return { count: items.length, catalogId };
}

/** Re-syncs when the local copy is older than `maxAgeMin`. Failures leave the last good copy in place. */
export async function ensureFreshCatalog(maxAgeMin = 30) {
  // Synced recently, or tried recently and failed: don't hold up a reply to try again.
  const row = await one<{ fresh: boolean }>(
    `select bool_or(updated_at > now() - make_interval(mins => $1)) as fresh
       from wa_setting where key in ('catalog_synced_at', 'catalog_sync_tried_at')`,
    [maxAgeMin],
  );
  if (row?.fresh) return;
  try {
    await syncCatalog();
  } catch (e) {
    console.error("[whatsapp] catalog sync failed:", e instanceof Error ? e.message : e);
    await query(
      `insert into wa_setting (key, value, updated_at) values ('catalog_sync_tried_at', now()::text, now())
       on conflict (key) do update set value = excluded.value, updated_at = now()`,
    );
  }
}

export const catalogSyncedAt = async () =>
  (await one<{ value: string }>(`select value from wa_setting where key = 'catalog_synced_at'`))?.value ?? null;

export const listProducts = (includeInactive = false) =>
  query<Product>(
    `select retailer_id, name, description, price, price_text, currency, image_url, url, availability, active, synced_at
       from wa_product where $1 or active order by active desc, name`,
    [includeInactive],
  );

export const getProducts = (ids: string[]) =>
  query<Product>(`select * from wa_product where retailer_id = any($1)`, [ids]);

export const inStock = (p: Pick<Product, "availability" | "active">) =>
  p.active && !/out of stock|discontinued/i.test(p.availability ?? "");

// ================================================================= cart -> order

export interface PricedCart {
  lines: (CartLine & { name: string; unit_price: number; line_total: number; image_url: string | null; available: boolean })[];
  subtotal: number;
  delivery_fee: number;
  total: number;
  currency: string;
  problems: string[];
}

export async function priceCart(cart: CartLine[]): Promise<PricedCart> {
  const products = new Map((await getProducts(cart.map((l) => l.retailer_id))).map((p) => [p.retailer_id, p]));
  const problems: string[] = [];
  const lines: PricedCart["lines"] = [];
  for (const l of cart) {
    const p = products.get(l.retailer_id);
    if (!p) {
      problems.push(`${l.retailer_id} is no longer in the catalog`);
      continue;
    }
    if (p.price === null) problems.push(`${p.name} has no price in the catalog`);
    const available = inStock(p);
    if (!available) problems.push(`${p.name} is out of stock`);
    const unit = p.price ?? 0;
    lines.push({ ...l, name: p.name, unit_price: unit, line_total: unit * l.qty, image_url: p.image_url, available });
  }
  const subtotal = lines.reduce((s, l) => s + l.line_total, 0);
  const free = shop.freeDeliveryAbove > 0 && subtotal >= shop.freeDeliveryAbove;
  const delivery_fee = lines.length && !free ? shop.deliveryFee : 0;
  const currency = products.values().next().value?.currency ?? "INR";
  return { lines, subtotal, delivery_fee, total: subtotal + delivery_fee, currency, problems };
}

export async function createOrder(
  waId: string,
  o: { payment_method: "upi" | "cod" | "link"; notes?: string | null; source: "chat" | "catalog" },
): Promise<{ order: Order; items: OrderItem[] }> {
  const contact = await getContact(waId);
  if (!contact) throw new Error("Unknown customer");
  if (!contact.cart.length) throw new Error("The cart is empty");
  if (!contact.delivery_address) throw new Error("No delivery address yet - ask the customer for it first");
  const priced = await priceCart(contact.cart);
  if (priced.problems.length) throw new Error(`Can't place the order: ${priced.problems.join("; ")}`);

  const id = await tx(async (c) => {
    const { rows } = await c.query<{ id: number }>(
      `insert into wa_order (wa_id, payment_method, subtotal, delivery_fee, total, currency,
                             delivery_name, delivery_address, notes, source)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
      [waId, o.payment_method, priced.subtotal, priced.delivery_fee, priced.total, priced.currency,
       contact.delivery_name ?? contact.name, contact.delivery_address, o.notes ?? null, o.source],
    );
    for (const l of priced.lines) {
      await c.query(
        `insert into wa_order_item (order_id, retailer_id, name, image_url, qty, unit_price, line_total)
         values ($1,$2,$3,$4,$5,$6,$7)`,
        [rows[0].id, l.retailer_id, l.name, l.image_url, l.qty, l.unit_price, l.line_total],
      );
    }
    await c.query(`update wa_contact set cart = '[]'::jsonb where wa_id = $1`, [waId]);
    return rows[0].id;
  });
  return (await getOrder(id))!;
}

const ORDER_SELECT = `
  select o.*, c.name as customer_name,
         (select coalesce(sum(qty),0)::int from wa_order_item i where i.order_id = o.id) as item_count,
         (select rating from wa_review r where r.order_id = o.id) as review_rating
    from wa_order o join wa_contact c on c.wa_id = o.wa_id`;

export async function getOrder(id: number): Promise<{ order: Order; items: OrderItem[] } | null> {
  const order = await one<Order>(`${ORDER_SELECT} where o.id = $1`, [id]);
  if (!order) return null;
  const items = await query<OrderItem>(
    `select retailer_id, name, image_url, qty, unit_price, line_total from wa_order_item where order_id = $1 order by id`,
    [id],
  );
  return { order, items };
}

export const getOrderByNo = (waId: string, orderNo: string) =>
  one<Order>(`${ORDER_SELECT} where o.wa_id = $1 and upper(o.order_no) = upper($2)`, [waId, orderNo.trim()]);

export function listOrders(f: { status?: string; waId?: string; search?: string } = {}) {
  return query<Order>(
    `${ORDER_SELECT}
      where ($1 = '' or ($1 = 'open' and o.status not in ('delivered','cancelled')) or o.status = $1)
        and ($2 = '' or o.wa_id = $2)
        and ($3 = '' or o.order_no ilike '%' || $3 || '%' or c.name ilike '%' || $3 || '%' or o.wa_id ilike '%' || $3 || '%')
      order by o.created_at desc limit 500`,
    [f.status ?? "", f.waId ?? "", (f.search ?? "").trim()],
  );
}

export const latestOpenOrder = (waId: string) =>
  one<Order>(`${ORDER_SELECT} where o.wa_id = $1 and o.status not in ('delivered','cancelled') order by o.created_at desc limit 1`, [waId]);

export async function updateOrder(id: number, patch: Partial<Pick<Order, "status" | "payment_status" | "payment_link" | "payment_ref" | "notes">>) {
  const keys = Object.keys(patch) as (keyof typeof patch)[];
  if (!keys.length) return;
  const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");
  await query(`update wa_order set ${sets}, updated_at = now() where id = $1`, [id, ...keys.map((k) => patch[k])]);
}

// ================================================================= reviews

export async function saveReview(r: { waId: string; orderId: number | null; rating?: number; comment?: string | null }) {
  if (r.orderId) {
    const existing = await one<{ id: number }>(`select id from wa_review where order_id = $1`, [r.orderId]);
    if (existing) {
      await query(
        `update wa_review set rating = coalesce($2, rating), comment = coalesce($3, comment), updated_at = now() where id = $1`,
        [existing.id, r.rating ?? null, r.comment ?? null],
      );
      return existing.id;
    }
  }
  if (!r.rating) throw new Error("A new review needs a rating from 1 to 5");
  const row = await one<{ id: number }>(
    `insert into wa_review (order_id, wa_id, rating, comment) values ($1, $2, $3, $4) returning id`,
    [r.orderId, r.waId, r.rating, r.comment ?? null],
  );
  return row!.id;
}

export interface ReviewRow {
  id: number;
  order_id: number | null;
  order_no: string | null;
  wa_id: string;
  name: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
}

export const listReviews = () =>
  query<ReviewRow>(
    `select r.id, r.order_id, o.order_no, r.wa_id, c.name, r.rating, r.comment, r.created_at
       from wa_review r join wa_contact c on c.wa_id = r.wa_id left join wa_order o on o.id = r.order_id
      order by r.created_at desc limit 500`,
  );

// ================================================================= formatting

export function money(n: number | null | undefined, currency = "INR") {
  if (n === null || n === undefined) return "—";
  const sym = currency === "INR" ? "₹" : `${currency} `;
  return `${sym}${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}
