import { FuelSectionPage } from "@/components/transport/FuelSectionPage";

export const dynamic = "force-dynamic";

export default async function MilkToPlantFuelPage({ searchParams }: PageProps<"/fuel/milk-to-plant">) {
  const { date } = await searchParams;
  return (
    <FuelSectionPage
      section="milk_to_plant"
      date={typeof date === "string" ? date : undefined}
      subtitle="Transport for bringing milk in to the plant - farmers' direct milk, and AB Dairy and Sai Dairy milk on the plant's own transport: what each ran each day, at the rate in force that day."
    />
  );
}
