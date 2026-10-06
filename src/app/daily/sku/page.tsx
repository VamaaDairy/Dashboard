import { PackageOpen } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SkuPackingDay } from "@/components/production/SkuPackingDay";
import { getBulkProducts } from "@/lib/production/data";
import { getBulkYields, getLastSkuMaterials, getPackagingOptions, getSkuDay, getSkuHistory, getSkuMaterials } from "@/lib/production/sku";
import { today } from "@/lib/dates";

export const dynamic = "force-dynamic";

/** What was packed into each SKU on one day, checked against the bulk batches' yield. */
export default async function SkuPackingPage({ searchParams }: PageProps<"/daily/sku">) {
  const { date: raw } = await searchParams;
  const now = today();
  const date = typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : now;
  const [skus, bulkProducts, yields, history, materials, lastMaterials, packaging] = await Promise.all([
    getSkuDay(date), getBulkProducts(), getBulkYields(date), getSkuHistory(),
    getSkuMaterials(date), getLastSkuMaterials(date), getPackagingOptions(),
  ]);

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-5">
        <PageHeader
          icon={PackageOpen}
          title="Production · SKU packing"
          subtitle="Each day's bulk batches packed into SKUs - cases, loose pieces and packing material for every SKU."
        />
        {/* keyed by date so the entry starts from that day's saved values */}
        <SkuPackingDay key={date} date={date} today={now} skus={skus} bulkProducts={bulkProducts} yields={yields} history={history}
          materials={materials} lastMaterials={lastMaterials} packaging={packaging} />
      </div>
    </div>
  );
}
