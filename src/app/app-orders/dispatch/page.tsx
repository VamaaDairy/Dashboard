import Link from "next/link";
import { cookies } from "next/headers";
import { Truck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { dispatchOrders, transporters, tripsOn } from "@/lib/dispatch";
import { todayIst } from "@/lib/orders/direct";
import { DispatchBoard } from "./board";

export const dynamic = "force-dynamic";

const nextDay = (d: string) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + 1);
  return x.toISOString().slice(0, 10);
};

/**
 * Dispatch: the day's confirmed trade orders go on trips (one per route, usually), each given to a transporter who
 * runs it in the Gaia Delivery app. Orders waiting for a trip on the left, the day's trips on the right.
 */
export default async function DispatchPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const sp = await searchParams;
  // by default tomorrow's deliveries: orders are for the day after they are placed
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : nextDay(todayIst());
  const [orders, trips, trucks, me] = await Promise.all([dispatchOrders(date), tripsOn(date), transporters(), userFromToken((await cookies()).get("session")?.value)]);
  const canEdit = !!me && atLeast(levelFor(me, "apporders"), "edit");

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-4">
        <PageHeader
          icon={Truck}
          title="Dispatch"
          subtitle="Confirmed distributor orders go on trips; the transporter starts the trip, delivers each stop and ends it in the Gaia Delivery app."
          actions={
            <form className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Delivery on</span>
              <input type="date" name="date" defaultValue={date} className="h-8 rounded-md border border-border bg-background px-2" />
              <button className="h-8 rounded-md border border-border px-3 hover:bg-muted">Show</button>
              <Link href="/app-orders/distributors" className="inline-flex h-8 items-center rounded-md border border-border px-3 hover:bg-muted">Orders</Link>
            </form>
          }
        />
        <DispatchBoard date={date} orders={orders} trips={trips} transporters={trucks.filter((t) => t.active)} canEdit={canEdit} />
      </div>
    </div>
  );
}
