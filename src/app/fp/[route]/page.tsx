import { notFound } from "next/navigation";
import { FpScreen } from "@/components/fp/FpScreen";
import { routeBySlug } from "@/lib/fp/model";
import { screenFor } from "@/lib/fp/screens";
import { customScreen } from "@/lib/fp/custom";
import { params, type SP } from "@/lib/orders/session";

export const dynamic = "force-dynamic";

export default async function Page({ params: p, searchParams }: { params: Promise<{ route: string }>; searchParams: SP }) {
  const { route: slug } = await p;
  const route = routeBySlug(decodeURIComponent(slug));
  if (!route) notFound();
  const screen = screenFor(route.key);
  if (!screen) notFound();
  const sp = await params(searchParams);
  return (await customScreen(route.key, sp)) ?? <FpScreen screen={screen} sp={sp} />;
}
