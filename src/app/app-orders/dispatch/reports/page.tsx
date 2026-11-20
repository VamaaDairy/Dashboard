import { dispatchReport } from "@/lib/dispatch/report";
import { todayIst } from "@/lib/orders/direct";
import { ReportView } from "./view";

export const dynamic = "force-dynamic";

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const minus = (iso: string, d: number) => {
  const x = new Date(`${iso}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() - d);
  return x.toISOString().slice(0, 10);
};

/** How the trips went over a period (the last 30 days unless ?from=&to= say otherwise). */
export default async function DispatchReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const sp = await searchParams;
  const today = todayIst();
  const to = sp.to && YMD.test(sp.to) ? sp.to : today;
  const from = sp.from && YMD.test(sp.from) && sp.from <= to ? sp.from : minus(to, 29);
  return <ReportView r={await dispatchReport(from, to)} today={today} />;
}
