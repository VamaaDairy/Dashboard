/**
 * Subscription orders create themselves: after the 9 PM cut-off (India) the next day's deliveries
 * become shop orders, and today's are caught up if the server was down at that time. Generating is
 * safe to repeat (a customer never gets two orders for one day), so this just checks every 10 minutes.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const g = globalThis as { __subscriptionTimer?: NodeJS.Timeout };
  if (g.__subscriptionTimer) return;

  const tick = async () => {
    try {
      const { addDays, CUTOFF_HOUR, generateOrders, todayIST } = await import("@/lib/shop/subscriptions");
      const hour = Number(new Date().toLocaleString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false }));
      const today = todayIST();
      const made = await generateOrders(today);
      const next = hour >= CUTOFF_HOUR ? await generateOrders(addDays(today, 1)) : { created: 0 };
      if (made.created || next.created) console.log(`[subscriptions] created ${made.created} order(s) for today, ${next.created} for tomorrow`);
    } catch (e) {
      console.error("[subscriptions] auto-create failed:", e instanceof Error ? e.message : e);
    }
  };
  g.__subscriptionTimer = setInterval(tick, 10 * 60 * 1000);
  setTimeout(tick, 30 * 1000);
}
