"use server";

import { revalidatePath } from "next/cache";
import { notifyPaid, notifyStatus, sendCatalog, sendReviewRequest } from "@/lib/whatsapp/flow";
import { publishLocalCatalog } from "@/lib/whatsapp/publish";
import {
  ORDER_STATUSES, PAYMENT_STATUSES, getOrder, syncCatalog, updateContact, updateOrder,
  type OrderStatus, type PaymentStatus,
} from "@/lib/whatsapp/store";

export type Result = { ok: true; message?: string } | { ok: false; error: string };

const fail = (e: unknown): Result => ({ ok: false, error: e instanceof Error ? e.message : String(e) });

/** Hands a chat to the assistant, or takes it back for a person. */
export async function setBotEnabled(waId: string, enabled: boolean): Promise<Result> {
  try {
    await updateContact(waId, { bot_enabled: enabled, ...(enabled ? { needs_human: false } : {}) });
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** The photo cards and the tap-to-order list, sent from a chat. */
export async function sendCatalogTo(waId: string): Promise<Result> {
  try {
    await sendCatalog(waId, "agent");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function clearNeedsHuman(waId: string): Promise<Result> {
  try {
    await updateContact(waId, { needs_human: false });
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function setOrderStatus(orderId: number, status: OrderStatus, notify: boolean): Promise<Result> {
  try {
    if (!ORDER_STATUSES.includes(status)) throw new Error("Unknown status");
    const got = await getOrder(orderId);
    if (!got) throw new Error("No such order");
    if (got.order.status === status) return { ok: true };
    await updateOrder(orderId, { status });
    if (status === "delivered" || status === "cancelled") {
      await updateContact(got.order.wa_id, { pending_review_order_id: null });
    }
    if (notify) await notifyStatus(orderId, status);
    revalidatePath("/whatsapp", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function setPaymentStatus(orderId: number, status: PaymentStatus, notify: boolean): Promise<Result> {
  try {
    if (!PAYMENT_STATUSES.includes(status)) throw new Error("Unknown payment status");
    const got = await getOrder(orderId);
    if (!got) throw new Error("No such order");
    if (got.order.payment_status === status) return { ok: true };
    await updateOrder(orderId, { payment_status: status });
    if (notify && status === "paid") await notifyPaid(orderId);
    revalidatePath("/whatsapp", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function saveOrderNotes(orderId: number, notes: string): Promise<Result> {
  try {
    await updateOrder(orderId, { notes: notes.trim() || null });
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function askForReview(orderId: number): Promise<Result> {
  try {
    await sendReviewRequest(orderId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Pushes data/wa-catalog.json (with its photos) to the Meta catalog, then reads the catalog back. */
export async function publishCatalogNow(): Promise<Result> {
  try {
    const r = await publishLocalCatalog();
    if (r.errors.length) return { ok: false, error: `Meta reported: ${r.errors.join("; ")}` };
    let synced = "";
    try {
      synced = ` Synced back ${(await syncCatalog()).count} product(s).`;
    } catch (e) {
      synced = ` Sync back failed: ${e instanceof Error ? e.message : e}`;
    }
    revalidatePath("/whatsapp", "layout");
    return {
      ok: true,
      message: `Published ${r.published.length} (batch ${r.status}).${r.skipped.length ? ` Skipped: ${r.skipped.join(", ")}.` : ""}${synced}`,
    };
  } catch (e) {
    return fail(e);
  }
}

export async function syncCatalogNow(): Promise<Result> {
  try {
    const r = await syncCatalog();
    revalidatePath("/whatsapp", "layout");
    return { ok: true, message: `Synced ${r.count} product(s) from catalog ${r.catalogId}` };
  } catch (e) {
    return fail(e);
  }
}
