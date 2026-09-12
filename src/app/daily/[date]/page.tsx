import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { DayEntry } from "@/components/DayEntry";
import { getDay } from "@/lib/daily/data";
import { computeDay } from "@/lib/daily/compute";

export const dynamic = "force-dynamic";

export default async function DayPage({ params }: PageProps<"/daily/[date]">) {
  const { date } = await params;
  const data = await getDay(date);
  if (!data) notFound();

  const costing = await computeDay(data.day.id);
  if (!costing) notFound();

  return (
    <div className="flex flex-col flex-1 bg-white p-4 md:p-6 min-h-screen">
      <div className="w-full space-y-5">
        <PageHeader
          icon={CalendarDays}
          title={new Date(`${data.day.day}T00:00:00`).toLocaleDateString("en-IN", {
            weekday: "long", day: "numeric", month: "long", year: "numeric",
          })}
          subtitle="Fill in the milk processed and what the plant spent — costs update as you type."
          actions={
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline" className="border-blue-200 bg-blue-50/60 text-[#2B4C86] font-mono font-bold text-xs">
                ₹{costing.totalProductionCost.toFixed(0)} produced
              </Badge>
              <Link href="/daily" className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[#3E5FA0]">
                ← All days
              </Link>
            </div>
          }
        />

        <DayEntry
          dayId={data.day.id}
          milkProcessed={data.day.milk_processed_l}
          heads={data.heads}
          products={data.products}
          costing={costing}
        />
      </div>
    </div>
  );
}
