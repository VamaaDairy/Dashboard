"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { query } from "@/lib/db";
import { assignRider, setOrderStatus } from "./orders";
import { hashPin } from "./rider";
import { STATUS_LABEL } from "./pricing";

/** Staff changing an order's status - needs edit access to Shop orders. */
export async function setStatusAction(id: number, status: string): Promise<{ ok: boolean; error?: string }> {
  const me = await userFromToken((await cookies()).get("session")?.value);
  if (!me || !atLeast(levelFor(me, "shop"), "edit")) return { ok: false, error: "You do not have permission to change this." };
  if (!(status in STATUS_LABEL)) return { ok: false, error: "Unknown status." };
  const ok = await setOrderStatus(id, status);
  if (ok) revalidatePath("/shop-orders");
  return ok ? { ok: true } : { ok: false, error: "That order no longer exists." };
}

async function canEdit() {
  const me = await userFromToken((await cookies()).get("session")?.value);
  return !!me && atLeast(levelFor(me, "shop"), "edit");
}

const NO = { ok: false as const, error: "You do not have permission to change this." };

export async function assignRiderAction(orderId: number, riderId: number | null): Promise<{ ok: boolean; error?: string }> {
  if (!(await canEdit())) return NO;
  const ok = await assignRider(orderId, riderId);
  if (ok) revalidatePath("/shop-orders");
  return ok ? { ok: true } : { ok: false, error: "This order can no longer be given to a rider." };
}

export async function addRiderAction(name: string, phone: string, pin: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await canEdit())) return NO;
  const p = phone.replace(/\D/g, "").slice(-10);
  if (name.trim().length < 2) return { ok: false, error: "Enter the rider's name." };
  if (!/^[6-9]\d{9}$/.test(p)) return { ok: false, error: "Enter a valid 10-digit mobile number." };
  if (!/^\d{4,8}$/.test(pin)) return { ok: false, error: "The PIN must be 4 to 8 digits." };
  try {
    await query(`insert into shop_rider (name, phone, pin_hash) values ($1, $2, $3)`, [name.trim(), p, hashPin(pin)]);
  } catch {
    return { ok: false, error: "A rider with this number already exists." };
  }
  revalidatePath("/shop-orders/riders");
  return { ok: true };
}

export async function setRiderAction(id: number, patch: { active?: boolean; pin?: string }): Promise<{ ok: boolean; error?: string }> {
  if (!(await canEdit())) return NO;
  if (patch.pin !== undefined) {
    if (!/^\d{4,8}$/.test(patch.pin)) return { ok: false, error: "The PIN must be 4 to 8 digits." };
    // a new PIN also signs the rider out of any phone still holding the old session
    await query(`update shop_rider set pin_hash = $2, token = null where id = $1`, [id, hashPin(patch.pin)]);
  }
  if (patch.active !== undefined) await query(`update shop_rider set active = $2, token = case when $2 then token else null end where id = $1`, [id, patch.active]);
  revalidatePath("/shop-orders/riders");
  return { ok: true };
}

// ---- home-screen banners ----

const POSTER_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const POSTER_MAX = 3 * 1024 * 1024;

/** Adds a banner, or updates one when the form carries an id. Posters are stored in the database. */
export async function saveBannerAction(form: FormData): Promise<{ ok: boolean; error?: string }> {
  if (!(await canEdit())) return NO;
  const text = (k: string) => String(form.get(k) ?? "").trim();
  const id = Number(text("id")) || null;
  const title = text("title");
  const sku = text("sku") || null;
  const bg = text("bgColor") || "#7EAEF5";
  const priority = Number(text("priority") || 0);
  const starts = text("startsAt") || null;
  const ends = text("endsAt") || null;
  const file = form.get("image");
  const poster = file instanceof File && file.size > 0 ? file : null;
  const removeImage = text("removeImage") === "1";

  if (!/^#[0-9a-f]{6}$/i.test(bg)) return { ok: false, error: "Pick a background colour." };
  if (!Number.isInteger(priority) || Math.abs(priority) > 10000) return { ok: false, error: "Priority must be a whole number." };
  if (starts && ends && ends < starts) return { ok: false, error: "The end date is before the start date." };
  if (poster && !POSTER_TYPES.has(poster.type)) return { ok: false, error: "The poster must be a JPG, PNG or WebP image." };
  if (poster && poster.size > POSTER_MAX) return { ok: false, error: "The poster must be under 3 MB." };
  if (sku && !(await query(`select 1 from fp_product where sku_code = $1`, [sku])).length) return { ok: false, error: "That product does not exist." };

  const bytes = poster ? Buffer.from(await poster.arrayBuffer()) : null;
  const vals = [title, text("subtitle") || null, text("cta") || null, sku, bg.toUpperCase(), priority, starts, ends];
  if (id) {
    // a new poster replaces the old one; "remove" goes back to a designed card
    const img = bytes ? `, image = $10, image_mime = $11` : removeImage ? `, image = null, image_mime = null` : "";
    const [row] = await query<{ image: boolean }>(
      `update shop_banner set title = $2, subtitle = $3, cta = $4, sku_code = $5, bg_color = $6, priority = $7, starts_at = $8, ends_at = $9,
              updated_at = now()${img}
        where id = $1 returning image is not null as image`,
      [id, ...vals, ...(bytes ? [bytes, poster!.type] : [])],
    );
    if (!row) return { ok: false, error: "That banner no longer exists." };
    if (!title && !row.image) return { ok: false, error: "Give the banner a title or a poster image." };
  } else {
    if (!title && !bytes) return { ok: false, error: "Give the banner a title or a poster image." };
    await query(
      `insert into shop_banner (title, subtitle, cta, sku_code, bg_color, priority, starts_at, ends_at, image, image_mime)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [...vals, bytes, poster?.type ?? null],
    );
  }
  revalidatePath("/shop-orders/banners");
  return { ok: true };
}

export async function setBannerAction(id: number, patch: { active?: boolean; priority?: number }): Promise<{ ok: boolean; error?: string }> {
  if (!(await canEdit())) return NO;
  if (patch.priority !== undefined && (!Number.isInteger(patch.priority) || Math.abs(patch.priority) > 10000)) return { ok: false, error: "Priority must be a whole number." };
  await query(
    `update shop_banner set active = coalesce($2, active), priority = coalesce($3, priority), updated_at = now() where id = $1`,
    [id, patch.active ?? null, patch.priority ?? null],
  );
  revalidatePath("/shop-orders/banners");
  return { ok: true };
}

export async function deleteBannerAction(id: number): Promise<{ ok: boolean; error?: string }> {
  if (!(await canEdit())) return NO;
  await query(`delete from shop_banner where id = $1`, [id]);
  revalidatePath("/shop-orders/banners");
  return { ok: true };
}

// ---- subscriptions ----

/** Turns tomorrow's (or [day]'s) subscriptions into orders now - the same as the evening job. */
export async function createSubscriptionOrdersAction(day?: string): Promise<{ ok: boolean; error?: string; created?: number; items?: number }> {
  if (!(await canEdit())) return NO;
  const { addDays, generateOrders, todayIST } = await import("./subscriptions");
  const d = day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : addDays(todayIST(), 1);
  const r = await generateOrders(d);
  revalidatePath("/shop-orders/subscriptions");
  revalidatePath("/shop-orders");
  return { ok: true, created: r.created, items: r.items };
}
