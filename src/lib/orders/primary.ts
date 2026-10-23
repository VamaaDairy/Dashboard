import "server-only";
import { one, tx } from "@/lib/db";

export type Decision = "confirm" | "cancel";
export type DecisionResult = { ok: true; status: string } | { ok: false; error: string };

/** The status words the Gaia app shows for a primary order the office has decided on. */
export const CONFIRMED = "Confirmed";
export const CANCELLED = "Cancelled";

/**
 * Confirms or cancels a pending primary order. Only a pending order can be decided, and the row is
 * locked while it is, so two people pressing at once cannot both win. The app reads the same
 * columns (status), so it shows the new status the next time it looks - a few seconds.
 */
export async function decideOrder(uid: string, action: Decision, who: string, reason?: string): Promise<DecisionResult> {
  if (!/^[0-9a-f-]{36}$/i.test(uid)) return { ok: false, error: "That order no longer exists." };
  const why = (reason ?? "").trim().slice(0, 300);
  if (action === "cancel" && !why) return { ok: false, error: "Give a reason for cancelling." };
  return tx(async (c): Promise<DecisionResult> => {
    const { rows } = await c.query<{ order_id: number; status: string }>(
      `select order_id, status from fp_booking_order where uid = $1 for update`,
      [uid],
    );
    const o = rows[0];
    if (!o) return { ok: false, error: "That order no longer exists." };
    if (o.status.toLowerCase() !== "pending") return { ok: false, error: `Order ${o.order_id} is already ${o.status.toLowerCase()}.` };

    const status = action === "confirm" ? CONFIRMED : CANCELLED;
    await c.query(
      action === "confirm"
        ? `update fp_booking_order set status = $2, current_status = $2, accepted_quantity = total_quantity, modified_time = now(), updated_at = now() where uid = $1`
        : `update fp_booking_order set status = $2, current_status = $2, cancelled_quantity = total_quantity, rejection_reason = $3, modified_time = now(), updated_at = now() where uid = $1`,
      action === "confirm" ? [uid, status] : [uid, status, why],
    );
    await c.query(
      `insert into master_audit (actor, slug, record_id, action, summary, before, after) values ($1, 'portalOrder', $2, $3, $4, $5, $6)`,
      [who, uid, action, `${status} order ${o.order_id}${why ? ` - ${why}` : ""}`, JSON.stringify({ status: o.status }), JSON.stringify({ status })],
    );
    return { ok: true, status };
  });
}

/** Changes whenever an order is added or decided: the list refreshes itself when this moves. */
export async function ordersPulse(): Promise<string> {
  const r = await one<{ p: string }>(`select count(*) || ':' || coalesce(extract(epoch from max(updated_at))::text, '0') as p from fp_booking_order`);
  return r?.p ?? "0";
}
