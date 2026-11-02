import { PackagePlus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { MovementForm } from "@/components/store/StoreForms";
import { MovementTable } from "@/components/store/MovementTable";
import { canEditStore, num } from "@/lib/store/access";
import { getMovements, getStock } from "@/lib/store/data";
import { today } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function StoreInPage({ searchParams }: PageProps<"/store/in">) {
  const sp = await searchParams;
  const [stock, rows, canEdit] = await Promise.all([getStock(), getMovements({ direction: "in", limit: 50 }), canEditStore()]);
  const items = stock.filter((i) => i.active).map((i) => ({ id: i.id, name: i.name, unit: i.unit, category: i.category, subcategory: i.subcategory, stock: i.stock }));

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-4">
        <PageHeader icon={PackagePlus} title="Stock in" subtitle="Record what was procured: the item, quantity, rate and supplier. It is added to stock straight away." />
        {canEdit ? <MovementForm direction="in" items={items} today={today()} defaultItem={num(sp.item)} /> : null}
        <h2 className="text-sm font-semibold">Latest 50 purchases</h2>
        <MovementTable rows={rows} canEdit={canEdit} empty="No purchases recorded yet." />
      </div>
    </div>
  );
}
