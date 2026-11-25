import { routeTabs } from "@/lib/dispatch/slot-route";
import { SlotRouteView } from "./view";

export const dynamic = "force-dynamic";

/** The route sheet's delivery rounds on Ola Maps, one route at a time: the order to reach every stop by its time. */
export default async function SlotRoutePage({ searchParams }: { searchParams: Promise<{ route?: string }> }) {
  const tabs = routeTabs();
  const { route } = await searchParams;
  const id = tabs.some((t) => t.id === route) ? route! : tabs[0].id;
  // a new view per route, so the last route's round is never shown under this one's name
  return <SlotRouteView key={id} tabs={tabs} id={id} />;
}
