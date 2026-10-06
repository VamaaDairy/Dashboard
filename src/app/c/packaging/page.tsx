import { Package } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { IngredientMaster } from "@/components/ingredients/IngredientMaster";
import { getIngredients } from "@/lib/ingredients/data";

export const dynamic = "force-dynamic";

/**
 * The packaging master: every packing item with its unit (per piece or per kg)
 * and one rate, GST included. Takes the place of the generic model grid for
 * this class, like the ingredient master.
 */
export default async function PackagingPage() {
  const items = await getIngredients("packaging");

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full max-w-4xl space-y-5">
        <PageHeader icon={Package} title="Packaging" subtitle="Pouches, cups, boxes, film - each with its unit and rate including GST." />
        <IngredientMaster ingredients={items} kind="packaging" />
      </div>
    </div>
  );
}
