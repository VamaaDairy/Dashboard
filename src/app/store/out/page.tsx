import { PackageMinus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { MovementForm } from "@/components/store/StoreForms";
import { MovementTable } from "@/components/store/MovementTable";
import { canEditStore, num } from "@/lib/store/access";
import { getMovements, getStock } from "@/lib/store/data";
import { today } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function StoreOutPage({ searchParams }: PageProps<"/store/out">) {
  const sp = await searchParams;
  const [stock, rows, canEdit] = await Promise.all([getStock(), getMovements({ direction: "out", limit: 50 }), canEditStore()]);
  const items = stock.filter((i) => i.active).map((i) => ({ id: i.id, name: i.name, unit: i.unit, category: i.category, subcategory: i.subcategory, stock: i.stock }));

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-4">
        <PageHeader icon={PackageMinus} title="Stock out" subtitle="Record what was issued from the store and who or what it was used for. You cannot issue more than is in stock." />
        {canEdit ? <MovementForm direction="out" items={items} today={today()} defaultItem={num(sp.item)} /> : null}
        <h2 className="text-sm font-semibold">Latest 50 issues</h2>
        <MovementTable rows={rows} canEdit={canEdit} empty="Nothing issued yet." />
      </div>
    </div>
  );
}
