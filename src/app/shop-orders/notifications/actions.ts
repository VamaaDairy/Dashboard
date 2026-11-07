"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { one, query } from "@/lib/db";
import { pushToRole } from "@/lib/push";
import { pushConfigured } from "@/lib/push/fcm";
import { PARTNER_LOG_PREFIX, type Audience, type NotifyApp, type Recipient, type SendSummary } from "@/lib/push/audiences";

/**
 * Push notifications, kept apart per app:
 * - "d2c": the Gaia D2C app (customers) and the delivery riders - /shop-orders/notifications, needs "shop".
 * - "partner": the distributor / retailer app - /app-orders/notifications, needs "apporders".
 * There is no "everyone" option: the "all" topic reaches every Gaia app at once.
 */
type Fail = { ok: false; error: string };

const APP_OF: Record<Audience, NotifyApp> = {
  customers: "d2c", customer: "d2c", riders: "d2c",
  partners: "partner", distributors: "partner", retailers: "partner", partner: "partner",
};
const KEY_OF: Record<NotifyApp, string> = { d2c: "shop", partner: "apporders" };
const PATH_OF: Record<NotifyApp, string> = { d2c: "/shop-orders/notifications", partner: "/app-orders/notifications" };

async function editor(app: NotifyApp) {
  const me = await userFromToken((await cookies()).get("session")?.value);
  return me && atLeast(levelFor(me, KEY_OF[app]), "edit") ? me : null;
}

export async function sendNotification(input: {
  audience: Audience; recipientId?: number | null; title: string; body: string;
}): Promise<{ ok: true; summary: SendSummary } | Fail> {
  const app = APP_OF[input.audience];
  if (!app) return { ok: false, error: "Unknown audience." };
  const me = await editor(app);
  if (!me) return { ok: false, error: "You do not have permission to do this." };
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title || !body) return { ok: false, error: "Enter a title and a message." };
  if (title.length > 80 || body.length > 300) return { ok: false, error: "Title up to 80 characters, message up to 300." };
  if (!pushConfigured()) return { ok: false, error: "Firebase is not configured on the server (FIREBASE_SERVICE_ACCOUNT_FILE)." };

  const m = { title, body, data: { type: "broadcast" } };
  let label: string;
  let r = { sent: 0, failed: 0 };
  switch (input.audience) {
    case "customers": label = "All customers"; r = await pushToRole("customer", null, m); break;
    case "riders": label = "All riders"; r = await pushToRole("rider", null, m); break;
    case "customer": {
      if (!input.recipientId) return { ok: false, error: "Pick a customer." };
      const c = await one<{ name: string; phone: string }>(`select name, phone from shop_customer where id = $1`, [input.recipientId]);
      if (!c) return { ok: false, error: "Customer not found." };
      label = `${c.name} (${c.phone})`;
      r = await pushToRole("customer", input.recipientId, m);
      break;
    }
    case "partners": {
      label = `${PARTNER_LOG_PREFIX}distributors & retailers`;
      const [d, t] = await Promise.all([pushToRole("distributor", null, m, "distributor"), pushToRole("distributor", null, m, "retailer")]);
      r = { sent: d.sent + t.sent, failed: d.failed + t.failed };
      break;
    }
    case "distributors": label = `${PARTNER_LOG_PREFIX}all distributors`; r = await pushToRole("distributor", null, m, "distributor"); break;
    case "retailers": label = `${PARTNER_LOG_PREFIX}all retailers`; r = await pushToRole("distributor", null, m, "retailer"); break;
    case "partner": {
      if (!input.recipientId) return { ok: false, error: "Pick a distributor or retailer." };
      const p = await one<{ name: string; phone: string; kind: string }>(
        `select coalesce(f.name, l.phone) as name, l.phone, l.kind from dist_login l left join fp_firm f on f.uid = l.firm_uid
          where l.id = $1 and l.kind in ('distributor', 'retailer')`, [input.recipientId]);
      if (!p) return { ok: false, error: "Distributor or retailer not found." };
      label = `${PARTNER_LOG_PREFIX}${p.name} (${p.kind}, ${p.phone})`;
      r = await pushToRole("distributor", input.recipientId, m);
      break;
    }
    default: return { ok: false, error: "Unknown audience." };
  }
  await query(`insert into push_log (audience, title, body, sent, failed, sent_by) values ($1, $2, $3, $4, $5, $6)`,
    [label, title, body, r.sent, r.failed, me.email]);
  revalidatePath(PATH_OF[app]);
  return { ok: true, summary: { audience: label.replace(PARTNER_LOG_PREFIX, ""), ...r } };
}

export async function searchRecipients(app: NotifyApp, q: string): Promise<Recipient[]> {
  if (!(await editor(app))) return [];
  const term = `%${q.trim()}%`;
  if (app === "d2c") {
    return query(`select id, name, phone from shop_customer where name ilike $1 or phone like $1 order by name limit 10`, [term]);
  }
  return query(
    `select l.id, coalesce(f.name, l.phone) as name, l.phone, l.kind from dist_login l left join fp_firm f on f.uid = l.firm_uid
      where l.active and l.kind in ('distributor', 'retailer') and (f.name ilike $1 or l.phone like $1)
      order by f.name limit 10`, [term]);
}
