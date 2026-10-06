import { today } from "@/lib/dates";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** A dashboard's period from ?from=&to=, defaulting to the last 30 days. */
export function periodFrom(sp: Record<string, string | string[] | undefined>) {
  const now = today();
  const back = new Date(`${now}T00:00:00Z`);
  back.setUTCDate(back.getUTCDate() - 29);
  const f = typeof sp.from === "string" && ISO.test(sp.from) ? sp.from : back.toISOString().slice(0, 10);
  const t = typeof sp.to === "string" && ISO.test(sp.to) ? sp.to : now;
  return f <= t ? { from: f, to: t, today: now } : { from: t, to: f, today: now };
}
