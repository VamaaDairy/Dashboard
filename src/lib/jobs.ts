import { pool } from "@/lib/db";

/**
 * The background jobs (subscription orders, UPI Autopay), run every 10 minutes - by the server's own timer
 * (src/instrumentation.ts) and / or an outside scheduler calling /api/cron/jobs.
 *
 * Only one run at a time across every app process: a run holds a Postgres advisory lock, and a process that cannot
 * take it skips the round. So any number of Dashboard copies can run side by side without placing a subscription order
 * or raising an Autopay debit twice (the jobs are also safe to repeat on their own).
 */
const LOCK = 7_310_001; // any constant shared by every process; names this lock in pg_locks

export interface JobsRun {
  ran: boolean;
  /** why it did not run */
  skipped?: "busy";
  subscriptions?: { today: number; tomorrow: number };
  autopay?: { notified: number; debited: number; checked: number };
  errors: string[];
  ms: number;
}

export async function runJobs(): Promise<JobsRun> {
  const started = Date.now();
  const client = await pool.connect();
  try {
    const { rows } = await client.query<{ ok: boolean }>(`select pg_try_advisory_lock($1) as ok`, [LOCK]);
    if (!rows[0]?.ok) return { ran: false, skipped: "busy", errors: [], ms: Date.now() - started };
    const out: JobsRun = { ran: true, errors: [], ms: 0 };
    try {
      try {
        const { addDays, CUTOFF_HOUR, generateOrders, todayIST } = await import("@/lib/shop/subscriptions");
        const hour = Number(new Date().toLocaleString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false }));
        const today = todayIST();
        const made = await generateOrders(today);
        const next = hour >= CUTOFF_HOUR ? await generateOrders(addDays(today, 1)) : { created: 0 };
        out.subscriptions = { today: made.created, tomorrow: next.created };
        if (made.created || next.created) console.log(`[jobs] created ${made.created} subscription order(s) for today, ${next.created} for tomorrow`);
      } catch (e) {
        out.errors.push(`subscriptions: ${e instanceof Error ? e.message : e}`);
      }
      // UPI Autopay: read back what's waiting on Easebuzz; in the evening window, debit and send notices
      try {
        const { runAutopay } = await import("@/lib/shop/autopay");
        out.autopay = await runAutopay();
        if (out.autopay.notified || out.autopay.debited) console.log(`[jobs] autopay: ${out.autopay.notified} notice(s), ${out.autopay.debited} debit(s), ${out.autopay.checked} checked`);
      } catch (e) {
        out.errors.push(`autopay: ${e instanceof Error ? e.message : e}`);
      }
    } finally {
      await client.query(`select pg_advisory_unlock($1)`, [LOCK]);
    }
    for (const e of out.errors) console.error("[jobs]", e);
    out.ms = Date.now() - started;
    return out;
  } finally {
    client.release();
  }
}
