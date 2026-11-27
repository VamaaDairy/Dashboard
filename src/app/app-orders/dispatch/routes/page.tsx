import { routeTabs } from "@/lib/dispatch/slot-route";
import { SlotRouteView } from "../../slot-route/view";

export const dynamic = "force-dynamic";

/**
 * Dispatch: Routes - the route sheet's delivery rounds on Ola Maps, one route at a time, inside the app (with the
 * sidebar). The same view is shared without sign-in at /app-orders/slot-route.
 */
export default async function DispatchRoutesPage({ searchParams }: { searchParams: Promise<{ route?: string }> }) {
  const tabs = routeTabs();
  const { route } = await searchParams;
  const id = tabs.some((t) => t.id === route) ? route! : tabs[0].id;
  // a new view per route, so the last route's round is never shown under this one's name
  return <SlotRouteView key={id} tabs={tabs} id={id} />;
}
