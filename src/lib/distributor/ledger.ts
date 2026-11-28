import "server-only";
import { one, query } from "@/lib/db";
import { fetchLedgerVouchers, getTree } from "@/lib/outstandings/tally";

/**
 * A distributor's account as Tally keeps it, for the Gaia Distributors app: what it owes now, and every bill,
 * receipt, credit note and journal in the period with the running balance. Read from Tally on the server (export
 * requests only, nothing written), by the Tally name in the Customer Master.
 *
 * Tally serves one request at a time, so the app's reads queue one behind another, and a ledger once read is kept
 * 15 minutes. When Tally can't be reached, the last copy is shown with when it was read.
 */

export interface LedgerEntry {
  /** yyyy-mm-dd */
  date: string;
  /** Tally's voucher type: Sales, Receipt, Credit Note, Journal… */
  type: string;
  /** the other side of the entry (Milk Sales, the bank, Discount…) */
  particulars: string;
  /** what it added to the account (a bill) */
  debit: number;
  /** what it took off (a payment, a credit note) */
  credit: number;
  /** what is owed after this entry (positive: owed to Gaia) */
  balance: number;
}

export interface DistLedger {
  ledger: string;
  months: number;
  from: string;
  to: string;
  opening: number;
  closing: number;
  totals: { debit: number; credit: number };
  entries: LedgerEntry[];
  /** when it was read from Tally */
  readAt: string;
  /** Tally couldn't be reached: this is the last copy */
  stale: boolean;
}

export const LEDGER_MONTHS = [1, 3, 6, 12] as const;
const KEEP_MS = 15 * 60_000;
const r2 = (n: number) => Math.round(n * 100) / 100;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** "5-Nov-26" (Tally's report) -> "2026-11-05"; anything else as it came. */
function isoOf(d: string): string {
  const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/.exec(d.trim());
  const mi = m ? MONTHS.indexOf(m[2]) : -1;
  if (!m || mi < 0) return d;
  const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  return `${y}-${String(mi + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

// one Tally read at a time, whoever asks
let queue: Promise<unknown> = Promise.resolve();
function inTurn<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job);
  queue = run.catch(() => undefined);
  return run;
}

async function readFromTally(ledger: string, months: number): Promise<Omit<DistLedger, "readAt" | "stale">> {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const [tree, vouchers] = await inTurn(async () => [await getTree(), await fetchLedgerVouchers(ledger, from, to)] as const);
  const l = tree.ledgers.find((x) => x.name === ledger);
  if (!l) throw new Error(`No ledger called "${ledger}" under Sundry Debtors in Tally.`);
  const closing = r2(l.balance);
  // Tally: a debit is negative
  const moves = vouchers.map((v) => ({
    date: isoOf(v.date), type: v.voucherType || "Entry", particulars: v.narration,
    debit: v.amount < 0 ? r2(-v.amount) : 0, credit: v.amount > 0 ? r2(v.amount) : 0,
  }));
  const debit = r2(moves.reduce((s, m) => s + m.debit, 0)), credit = r2(moves.reduce((s, m) => s + m.credit, 0));
  // the period ends today, so the opening is today's balance less what the period added
  const opening = r2(closing - (debit - credit));
  let bal = opening;
  const entries = moves.map((m) => ({ ...m, balance: (bal = r2(bal + m.debit - m.credit)) }));
  return { ledger, months, from: ymd(from), to: ymd(to), opening, closing, totals: { debit, credit }, entries };
}

/** The ledger of [ledger] for the last [months] months (this month counts as one), from Tally or the last copy. */
export async function distLedger(ledger: string, months: number): Promise<DistLedger | null> {
  const m = (LEDGER_MONTHS as readonly number[]).includes(months) ? months : 3;
  const kept = await one<{ data: DistLedger; read_at: Date }>(`select data, read_at from tally_ledger_cache where ledger = $1 and months = $2`, [ledger, m]);
  if (kept && Date.now() - new Date(kept.read_at).getTime() < KEEP_MS) return { ...kept.data, stale: false };
  try {
    const fresh = await readFromTally(ledger, m);
    const data: DistLedger = { ...fresh, readAt: new Date().toISOString(), stale: false };
    await query(
      `insert into tally_ledger_cache (ledger, months, data, read_at) values ($1, $2, $3, now())
       on conflict (ledger, months) do update set data = excluded.data, read_at = excluded.read_at`,
      [ledger, m, JSON.stringify(data)],
    );
    return data;
  } catch (e) {
    console.error("distributor ledger", ledger, e instanceof Error ? e.message : e);
    return kept ? { ...kept.data, stale: true } : null;
  }
}
