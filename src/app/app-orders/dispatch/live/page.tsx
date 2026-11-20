import { liveDispatch } from "@/lib/dispatch/live";
import { todayIst } from "@/lib/orders/direct";
import { LiveBoard } from "./board";

export const dynamic = "force-dynamic";

/** Live: every trip of the day on one map with each truck, its road and what needs a look; refreshed every 15 s. */
export default async function LivePage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const sp = await searchParams;
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayIst();
  return <LiveBoard key={date} date={date} initial={await liveDispatch(date)} />;
}
