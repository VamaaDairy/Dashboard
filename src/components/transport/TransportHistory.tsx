import Link from "next/link";
import { Empty, Num, Section, THead, Th } from "@/components/tanks/ui";
import { formatNumber } from "@/lib/format";
import type { HistoryDay, TransporterRow } from "@/lib/transport/data";

/** Day by day, newest first: each transporter's km / trips and cost, the day's total, and per litre of milk. */
export function TransportHistory({
  days, transporters, basePath, selected,
}: {
  days: HistoryDay[];
  transporters: TransporterRow[];
  basePath: string;
  selected: string;
}) {
  // Only transporters that appear in the history, plus the active ones.
  const shown = transporters.filter(
    (t) => t.is_active || days.some((d) => d.by_transporter[t.id]),
  );
  const cols = shown.length + 4;
  const grand = days.reduce((s, d) => s + d.total, 0);

  return (
    <Section
      title="Day by day"
      description="What each day cost, at the rate in force that day. Each day's total is that day's fuel cost on the Production page, spread across what was made by milk processed. Click a date to open it in the day entry above."
    >
      <div className="overflow-x-auto">
        <table className="w-full whitespace-nowrap text-[13px]">
          <THead>
            <Th align="left">Date</Th>
            {shown.map((t) => <Th key={t.id}>{t.name}</Th>)}
            <Th>Total ₹</Th>
            <Th>Milk L</Th>
            <Th>₹ / L</Th>
          </THead>
          <tbody>
            {days.map((d) => (
              <tr
                key={d.run_date}
                className={`border-b border-border/70 hover:bg-muted ${d.run_date === selected ? "bg-accent/60" : ""}`}
              >
                <td className="px-3 py-1.5">
                  <Link href={`${basePath}?date=${d.run_date}`} className="font-semibold text-foreground hover:underline">
                    {d.run_date}
                  </Link>
                  {d.missing ? (
                    <span className="ml-1 text-[10px] font-bold text-amber-700" title="No rate for that day, or no km / trips / litres entered">
                      {d.missing} not costed
                    </span>
                  ) : null}
                </td>
                {shown.map((t) => {
                  const run = d.by_transporter[t.id];
                  if (!run) return <td key={t.id} className="px-3 py-1.5 text-right text-tertiary-foreground">—</td>;
                  const units =
                    run.diesel_litre !== null ? `${formatNumber(run.diesel_litre, 0)} L diesel`
                    : run.trips !== null ? `${formatNumber(run.trips, 0)} trip(s)`
                    : run.distance_km !== null ? `${formatNumber(run.distance_km, 0)} km`
                    : "";
                  return (
                    <td key={t.id} className="num px-3 py-1.5 text-right">
                      {run.cost === null ? <span className="text-amber-700">?</span> : formatNumber(run.cost, 2)}
                      <div className="text-[10px] text-muted-foreground">{units}</div>
                    </td>
                  );
                })}
                <Num value={d.total} className="font-black text-foreground" />
                <Num value={d.milk_processed_l} decimals={0} dim />
                <Num value={d.milk_processed_l ? d.total / d.milk_processed_l : null} decimals={3} />
              </tr>
            ))}
            {days.length === 0 ? <Empty colSpan={cols}>No days entered yet. Save the first one above.</Empty> : null}
          </tbody>
          {days.length > 0 ? (
            <tfoot>
              <tr className="bg-accent font-semibold">
                <td className="px-3 py-2" colSpan={shown.length + 1}>Total, {days.length} day(s)</td>
                <Num value={grand} className="font-black text-foreground" />
                <td colSpan={2} />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </Section>
  );
}
