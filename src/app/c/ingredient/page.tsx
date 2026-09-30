import { Beaker } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { IngredientMaster } from "@/components/ingredients/IngredientMaster";
import { getIngredients } from "@/lib/ingredients/data";

export const dynamic = "force-dynamic";

/**
 * The ingredient master: every ingredient with its unit and rate per unit.
 * Takes the place of the generic model grid for this one class, so the other
 * classes (products, packaging, batch rates) keep their grid.
 */
export default async function IngredientsPage() {
  const ingredients = await getIngredients();

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full max-w-4xl space-y-5">
        <PageHeader icon={Beaker} title="Ingredients" subtitle="Everything that goes into production besides milk, with its unit and rate." />
        <IngredientMaster ingredients={ingredients} />
      </div>
    </div>
  );
}
