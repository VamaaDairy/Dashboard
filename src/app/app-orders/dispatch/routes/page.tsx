import { plant, routesOnMap } from "@/lib/dispatch";
import { routeStats } from "@/lib/dispatch/route-stats";
import { RoutesView } from "./view";

export const dynamic = "force-dynamic";

/** Routes: every route from the plant on the whole screen, with each one's road round and its last 30 days of trips. */
export default async function DispatchRoutesPage() {
  const [routes, stats] = await Promise.all([routesOnMap(), routeStats(30)]);
  return <RoutesView routes={routes} plant={plant()} stats={stats} />;
}
