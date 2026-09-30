import { FuelSectionPage } from "@/components/transport/FuelSectionPage";

export const dynamic = "force-dynamic";

export default async function DeliveryFuelPage({ searchParams }: PageProps<"/fuel/delivery">) {
  const { date } = await searchParams;
  return (
    <FuelSectionPage
      section="delivery"
      date={typeof date === "string" ? date : undefined}
      subtitle="Transport for taking goods out of the plant to market: km or trips each day, at the rate in force that day."
    />
  );
}
