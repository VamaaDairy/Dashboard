import Link from "next/link";
import { ListChecks } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { BulkProductMaster } from "@/components/production/BulkProductMaster";
import { getBulkProducts, getIngredientOptions } from "@/lib/production/data";

export const dynamic = "force-dynamic";

/** The bulk product master: what's made in bulk, and each product's ingredient list. */
export default async function BulkProductsPage() {
  const [products, options] = await Promise.all([getBulkProducts(), getIngredientOptions()]);

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-5">
        <PageHeader
          icon={ListChecks}
          title="Products & ingredients"
          subtitle="What the plant makes in bulk, and which ingredients go into each - the daily Production table follows this list."
          actions={<Link href="/daily" className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground">← Production</Link>}
        />
        <BulkProductMaster products={products} options={options} />
      </div>
    </div>
  );
}
