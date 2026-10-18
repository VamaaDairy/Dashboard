import { Package } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PackagingMaster } from "@/components/packaging/PackagingMaster";
import { getPackagingMaster } from "@/lib/packaging/data";

export const dynamic = "force-dynamic";

/**
 * The packaging master: every packing item with its category, spec, supplier
 * and the base rate, GST and freight its rate (the one the cost model reads)
 * is built from. Takes the place of the generic model grid for this class.
 */
export default async function PackagingPage() {
  const items = await getPackagingMaster();

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-5">
        <PageHeader icon={Package} title="Packing material" subtitle="Film, cups, cartons, jars - each with its particulars and the rate built from base, GST and freight." />
        <PackagingMaster items={items} />
      </div>
    </div>
  );
}
