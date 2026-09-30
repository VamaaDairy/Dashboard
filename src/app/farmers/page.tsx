import { Contact } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { FarmerList, type FarmerListRow } from "@/components/farmers/FarmerList";
import { getFarmerSummaries, getFarmerTransporters, getTransportShares } from "@/lib/farmers/data";
import { getTransporters } from "@/lib/transport/data";
import { kgPerLitre } from "@/lib/procurement/data";
import { addDays, today } from "@/lib/dates";
import { ensureDays, ensureFarmers, storedFarmers } from "@/lib/vamaa/sync";

export const dynamic = "force-dynamic";

/** Every registered farmer with their last 30 days, from the local copy of the Vamaa data. */
export default async function FarmersPage() {
  const to = today();
  const from = addDays(to, -29);

  // Top up the local copy; if the app can't be reached, carry on with what's saved.
  let notice: string | null = null;
  try {
    await Promise.all([ensureFarmers(), ensureDays(from, to)]);
  } catch (e) {
    notice = `Couldn't reach the Vamaa app, so this shows what's saved locally: ${e instanceof Error ? e.message : String(e)}`;
  }

  const k = await kgPerLitre();
  const [farmers, recent, ever, assigned, shares, transporters] = await Promise.all([
    storedFarmers(),
    getFarmerSummaries(from, to, k),
    getFarmerSummaries("2000-01-01", to, k),
    getFarmerTransporters(),
    getTransportShares(from, to),
    getTransporters("milk_to_plant"),
  ]);

  const rows: FarmerListRow[] = farmers.map((f) => ({
    code: f.code,
    name: f.name_en || [f.first_name, f.last_name].filter(Boolean).join(" "),
    mobile: f.mobile ?? "",
    milk_type: f.milk_type ?? "",
    recent: recent[f.code],
    last_day: ever[f.code]?.last_day ?? null,
    transporter_id: assigned[f.code],
    transport: shares[f.code],
  }));

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-5">
        <PageHeader icon={Contact} title="Farmers" subtitle="Everyone registered at the centre, and how much milk they've brought in." />
        {notice ? (
          <div className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-[13px] font-semibold text-foreground">{notice}</div>
        ) : null}
        <FarmerList
          farmers={rows}
          from={from}
          to={to}
          transporters={transporters.filter((t) => t.is_active).map((t) => ({ id: t.id, name: t.name }))}
        />
      </div>
    </div>
  );
}
