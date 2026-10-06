import { CalendarDays } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { BulkProductionDay } from "@/components/production/BulkProductionDay";
import { getBatches, getBulkProducts, getIngredientOptions, getProductionDays } from "@/lib/production/data";
import { kgPerLitre } from "@/lib/procurement/data";
import { getTanksOnDate } from "@/lib/tanks/data";
import { getCosting } from "@/lib/costing/actual";
import { today } from "@/lib/dates";

export const dynamic = "force-dynamic";

/** Bulk batch production for one day - every product made in bulk, before packing into sizes. */
export default async function DailyPage({ searchParams }: PageProps<"/daily">) {
  const { date: raw } = await searchParams;
  const now = today();
  const date = typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : now;

  const [products, batches, ingredients, history, k, tanks, costing] = await Promise.all([
    getBulkProducts(), getBatches(date), getIngredientOptions(), getProductionDays(), kgPerLitre(), getTanksOnDate(date),
    getCosting(date, date),
  ]);
  const day = costing.days[0];
  const shared = { amount: day?.shared ?? 0, litres: day?.milk_litre ?? 0, rate: day?.rate_per_litre ?? null };

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-5">
        <PageHeader
          icon={CalendarDays}
          title="Production"
          subtitle="Bulk batches made each day - milk drawn from the tanks, the ingredients and labour that went into every product before packing, and the yield."
        />
        {/* keyed by date so the table starts from that day's saved values */}
        <BulkProductionDay
          key={date}
          date={date}
          today={now}
          products={products}
          batches={batches}
          ingredients={ingredients}
          kgPerLitre={k}
          history={history}
          tanks={tanks}
          shared={shared}
        />
      </div>
    </div>
  );
}
