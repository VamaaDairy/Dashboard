import { LayoutDashboard } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ProductionDashboard } from "@/components/dash/ProductionDashboard";
import { getCosting } from "@/lib/costing/actual";
import { getTankInTotal } from "@/lib/dash/data";
import { periodFrom } from "@/lib/dash/period";

export const dynamic = "force-dynamic";

/** Production over a period: milk to packed goods, what was produced, and where every shared cost went. */
export default async function ProductionDashboardPage({ searchParams }: PageProps<"/daily/dashboard">) {
  const { from, to, today } = periodFrom(await searchParams);
  const [costing, tankIn] = await Promise.all([getCosting(from, to), getTankInTotal(from, to)]);
  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-5">
        <PageHeader icon={LayoutDashboard} title="Production · Dashboard"
          subtitle="Milk to packed goods: how much was made, in crates, boxes and pieces, and where every rupee of shared cost went." />
        <ProductionDashboard from={from} to={to} today={today} costing={costing} tankIn={tankIn} />
      </div>
    </div>
  );
}
