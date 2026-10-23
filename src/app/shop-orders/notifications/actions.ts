"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { one, query } from "@/lib/db";
import { notifyTopic, pushToRole } from "@/lib/push";
import { pushConfigured } from "@/lib/push/fcm";

type Fail = { ok: false; error: string };
export type Audience = "all" | "customers" | "riders" | "distributors" | "customer";
export interface SendSummary { audience: string; sent: number; failed: number }

export async function sendNotification(input: {
  audience: Audience; customerId?: number | null; title: string; body: string;
}): Promise<{ ok: true; summary: SendSummary } | Fail> {
  const me = await userFromToken((await cookies()).get("session")?.value);
  if (!me || !atLeast(levelFor(me, "shop"), "edit")) return { ok: false, error: "You do not have permission to do this." };
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title || !body) return { ok: false, error: "Enter a title and a message." };
  if (title.length > 80 || body.length > 300) return { ok: false, error: "Title up to 80 characters, message up to 300." };
  if (!pushConfigured()) return { ok: false, error: "Firebase is not configured on the server (FIREBASE_SERVICE_ACCOUNT_FILE)." };

  const m = { title, body, data: { type: "broadcast" } };
  let label: string;
  let sent = 0;
  let failed = 0;
  if (input.audience === "all") {
    label = "Everyone with the app";
    if (await notifyTopic("all", m)) sent = 1; else failed = 1;
  } else if (input.audience === "customer") {
    if (!input.customerId) return { ok: false, error: "Pick a customer." };
    const c = await one<{ name: string; phone: string }>(`select name, phone from shop_customer where id = $1`, [input.customerId]);
    if (!c) return { ok: false, error: "Customer not found." };
    label = `${c.name} (${c.phone})`;
    ({ sent, failed } = await pushToRole("customer", input.customerId, m));
  } else {
    const role = input.audience === "customers" ? "customer" : input.audience === "riders" ? "rider" : "distributor";
    label = `All ${input.audience}`;
    ({ sent, failed } = await pushToRole(role, null, m));
  }
  await query(`insert into push_log (audience, title, body, sent, failed, sent_by) values ($1, $2, $3, $4, $5, $6)`,
    [label, title, body, sent, failed, me.email]);
  revalidatePath("/shop-orders/notifications");
  return { ok: true, summary: { audience: label, sent, failed } };
}

export async function searchCustomers(q: string): Promise<{ id: number; name: string; phone: string }[]> {
  const me = await userFromToken((await cookies()).get("session")?.value);
  if (!me || !atLeast(levelFor(me, "shop"), "edit")) return [];
  const term = `%${q.trim()}%`;
  return query(`select id, name, phone from shop_customer where name ilike $1 or phone like $1 order by name limit 10`, [term]);
}
