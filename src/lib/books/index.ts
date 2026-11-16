import "server-only";
import type { PoolClient } from "pg";
import { query } from "@/lib/db";

/**
 * Distributor books (db/104 dist_ledger) - the groundwork: every money movement with a trade customer, one row each,
 * debit what it owes us more (an invoice), credit what it paid or got back. No screens yet; invoices post themselves.
 *
 * An order's invoice is on the books while the order is confirmed (or beyond): confirming posts it, an edit before
 * confirmation re-posts it at the new amount, cancelling or reopening takes it off.
 */

export type LedgerKind = "opening" | "invoice" | "payment" | "credit_note" | "debit_note" | "adjustment";

/** Brings one order's invoice line on the books in step with the order, inside [c]'s transaction. */
export async function syncOrderLedger(c: PoolClient, orderUid: string): Promise<void> {
  const o = (await c.query<{ firm: string | null; status: string; orderId: number; invoiceNo: string | null; total: string | null; issued: Date | null }>(
    `select b.from_firm_uid as firm, b.status, b.order_id as "orderId", i.invoice_no as "invoiceNo", i.data -> 'totals' ->> 'total' as total, i.issued_at as issued
       from fp_booking_order b left join dist_invoice i on i.booking_order_uid = b.uid where b.uid = $1`,
    [orderUid],
  )).rows[0];
  const live = !!o?.firm && !!o.invoiceNo && !/^(pending|cancel|reject)/i.test(o.status);
  if (!live) {
    await c.query(`delete from dist_ledger where order_uid = $1 and kind = 'invoice'`, [orderUid]);
    return;
  }
  await c.query(
    `insert into dist_ledger (firm_uid, entry_date, kind, ref, order_uid, debit, notes, created_by)
     values ($1, ($2::timestamptz at time zone 'Asia/Kolkata')::date, 'invoice', $3, $4, $5, $6, 'auto')
     on conflict (firm_uid, kind, ref) where ref is not null do update set debit = excluded.debit, order_uid = excluded.order_uid`,
    [o.firm, o.issued, o.invoiceNo, orderUid, Number(o.total ?? 0), `Order ${o.orderId}`],
  );
}

export interface LedgerRow { id: number; date: string; kind: LedgerKind; ref: string | null; debit: number; credit: number; balance: number; notes: string | null }

/** A customer's books, oldest first, with the running balance (positive: it owes us). */
export async function ledgerOf(firmUid: string, from?: string, to?: string): Promise<{ opening: number; rows: LedgerRow[]; closing: number }> {
  const f = from ?? "1900-01-01", t = to ?? "9999-12-31";
  const [{ opening }] = await query<{ opening: number }>(
    `select coalesce(sum(debit - credit), 0)::float as opening from dist_ledger where firm_uid = $1 and entry_date < $2::date`,
    [firmUid, f],
  );
  const rows = await query<Omit<LedgerRow, "balance">>(
    `select id, entry_date::text as date, kind, ref, debit::float as debit, credit::float as credit, notes
       from dist_ledger where firm_uid = $1 and entry_date between $2::date and $3::date order by entry_date, id`,
    [firmUid, f, t],
  );
  let bal = opening;
  const out = rows.map((r) => ({ ...r, balance: Math.round((bal += r.debit - r.credit) * 100) / 100 }));
  return { opening, rows: out, closing: Math.round(bal * 100) / 100 };
}

/** Every customer's balance. */
export const balances = () =>
  query<{ firmUid: string; name: string; debit: number; credit: number; balance: number; lastEntry: string | null }>(
    `select v.firm_uid as "firmUid", f.name, v.debit::float, v.credit::float, v.balance::float, v.last_entry::text as "lastEntry"
       from dist_ledger_balance v join fp_firm f on f.uid = v.firm_uid order by v.balance desc`,
  );
