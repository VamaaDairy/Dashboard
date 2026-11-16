/**
 * Background jobs (src/lib/jobs.ts): subscription orders create themselves after the 9 PM cut-off (India) and today's
 * are caught up if the server was down then; UPI Autopay notices and debits go out. Every 10 minutes.
 *
 * Each server process runs its own timer, but a run takes a database lock, so with several Dashboard copies only one
 * does the work each round. Set BACKGROUND_JOBS=off in .env to stop the timer in this process - for example when an
 * outside scheduler calls /api/cron/jobs instead, or on a copy that should only serve pages.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.BACKGROUND_JOBS === "off") {
    console.log("[jobs] BACKGROUND_JOBS=off: this process does not run the background jobs");
    return;
  }
  const g = globalThis as { __subscriptionTimer?: NodeJS.Timeout };
  if (g.__subscriptionTimer) return;

  const tick = async () => {
    try {
      const { runJobs } = await import("@/lib/jobs");
      await runJobs();
    } catch (e) {
      console.error("[jobs] run failed:", e instanceof Error ? e.message : e);
    }
  };
  g.__subscriptionTimer = setInterval(tick, 10 * 60 * 1000);
  setTimeout(tick, 30 * 1000);
}
