import Link from "next/link";
import { cookies } from "next/headers";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { dispatchOrders, plant, routesOnMap, transporters, tripsOn } from "@/lib/dispatch";
import { todayIst } from "@/lib/orders/direct";
import { DispatchBoard } from "./board";
import { RoutesMap } from "./routes-map";
import { DayStepper } from "./screen";

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
  const [orders, trips, trucks, routes, me] = await Promise.all([dispatchOrders(date), tripsOn(date), transporters(), routesOnMap(), userFromToken((await cookies()).get("session")?.value)]);
  const canEdit = !!me && atLeast(levelFor(me, "apporders"), "edit");

  return (
    <div className="flex flex-1 flex-col bg-background px-4 pt-3 pb-6 md:px-6">
      <div className="w-full space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <p className="mr-auto text-sm text-tertiary-foreground">Confirmed orders go on trips; the transporter starts the trip, delivers each stop and ends it in the Gaia Delivery app.</p>
          <span className="text-sm text-muted-foreground">Delivery on</span>
          <DayStepper date={date} base="/app-orders/dispatch" />
          <Link href="/app-orders/distributors" className="inline-flex h-8 items-center rounded-lg border border-input px-3 text-sm hover:bg-muted">Orders</Link>
        </div>
        <DispatchBoard date={date} orders={orders} trips={trips} transporters={trucks.filter((t) => t.active)} canEdit={canEdit} />
        <RoutesMap routes={routes} plant={plant()} />
      </div>
    </div>
  );
}
