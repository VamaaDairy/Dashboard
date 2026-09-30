import Link from "next/link";
import { Fuel } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { TransportDayEntry } from "@/components/transport/TransportDayEntry";
import { TransporterRates } from "@/components/transport/TransporterRates";
import { TransportHistory } from "@/components/transport/TransportHistory";
import { DieselPrice } from "@/components/transport/DieselPrice";
import {
  getDayEntry, getDieselPrices, getHistory, getRates, getTransporters, today, type TransportSection,
} from "@/lib/transport/data";
import { TRANSPORT_SECTIONS } from "@/lib/transport/sections";

/** One leg's fuel: the day entry, the rates, and every day so far. */
export async function FuelSectionPage({
  section, subtitle, date,
}: {
  section: TransportSection;
  subtitle: string;
  date?: string;
}) {
  const { label, path } = TRANSPORT_SECTIONS[section];
  const basePath = `/fuel/${path}`;
  const now = today();
  const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : now;

  const [entry, transporters, rates, history, dieselPrices] = await Promise.all([
    getDayEntry(section, day),
    getTransporters(section),
    getRates(section),
    getHistory(section),
    getDieselPrices(),
  ]);
  const dieselNow = dieselPrices.find((p) => p.effective_from <= now)?.price_per_litre;

  return (
    <div className="flex flex-col flex-1 bg-background p-4 md:p-6 min-h-screen">
      <div className="w-full space-y-5">
        <PageHeader icon={Fuel} title={`Fuel · ${label}`} subtitle={subtitle} />
        {/* keyed by date so switching days starts from that day's values */}
        <TransportDayEntry key={day} section={section} date={day} rows={entry} basePath={basePath} />
        <TransportHistory days={history} transporters={transporters} basePath={basePath} selected={day} />
        <TransporterRates
          section={section} transporters={transporters} rates={rates} today={now} dieselPrice={dieselNow}
        />
        <DieselPrice prices={dieselPrices} today={now} />
        <p className="text-[11px] text-muted-foreground">
          Transporters are added and renamed on the{" "}
          <Link href={`/transport/${path}`} className="font-semibold text-foreground hover:underline">
            Transport · {label}
          </Link>{" "}
          page.
        </p>
      </div>
    </div>
  );
}
