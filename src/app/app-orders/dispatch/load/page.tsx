import Link from "next/link";
import { dispatchOrders } from "@/lib/dispatch";
import { dayTotal, loadSheet, type LoadLine } from "@/lib/dispatch/load";
import { todayIst } from "@/lib/orders/direct";
import { PrintButton } from "@/app/shop-orders/slips/print-button";
import { TripStatusPill } from "../board";
import { DayStepper } from "../screen";

export const dynamic = "force-dynamic";

const nextDay = (d: string) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + 1);
  return x.toISOString().slice(0, 10);
};
const n = (v: number) => v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
const day = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" });

function LoadTable({ lines }: { lines: LoadLine[] }) {
  if (!lines.length) return <p className="py-3 text-sm text-muted-foreground">No products on it yet.</p>;
  const pieces = lines.reduce((s, l) => s + l.qty, 0);
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-[12px] text-muted-foreground">
        <tr className="border-b border-foreground/15">
          <th className="py-1.5 pr-3 font-medium">Product</th>
          <th className="py-1.5 pr-3 text-right font-medium">Crates / boxes</th>
          <th className="py-1.5 pr-3 text-right font-medium">Loose</th>
          <th className="py-1.5 pr-3 text-right font-medium">Total pieces</th>
          <th className="py-1.5 text-right font-medium">Orders</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((l) => (
          <tr key={l.sku} className="border-b border-foreground/5">
            <td className="py-1.5 pr-3">{l.name}</td>
            <td className="py-1.5 pr-3 text-right font-semibold tabular-nums">{l.pack ? `${n(l.packs)} ${l.pack.unit}` : "-"}</td>
            <td className="py-1.5 pr-3 text-right tabular-nums">{l.loose ? `${n(l.loose)} ${l.pack?.base ?? "PCS"}` : "-"}</td>
            <td className="py-1.5 pr-3 text-right tabular-nums">{n(l.qty)}{l.pack ? ` (${l.pack.per} a ${l.pack.unit})` : ""}</td>
            <td className="py-1.5 text-right tabular-nums text-muted-foreground">{l.orders}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td className="pt-2 pr-3 font-semibold">{lines.length} products</td>
          <td colSpan={2} />
          <td className="pt-2 pr-3 text-right font-semibold tabular-nums">{n(pieces)}</td>
          <td />
        </tr>
      </tfoot>
    </table>
  );
}

/**
 * Load sheet: what goes on each vehicle for a delivery day - the products of the orders on each trip, added up in whole
 * crates / boxes and loose pieces - and the day's total for the plant to pick. Printable: one block per vehicle.
 */
export default async function LoadSheetPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const sp = await searchParams;
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : nextDay(todayIst());
  const [trips, orders] = await Promise.all([loadSheet(date), dispatchOrders(date)]);
  const waiting = orders.filter((o) => o.tripId === null).length;
  const total = dayTotal(trips);

  return (
    <div className="flex flex-1 flex-col bg-background px-4 pt-3 pb-8 md:px-6">
      <style>{`@media print { body * { visibility: hidden; } .load-sheet, .load-sheet * { visibility: visible; } .load-sheet { position: absolute; inset: 0; padding: 0 8mm; } .load-trip { break-inside: avoid; } }`}</style>
      <div className="mb-4 flex flex-wrap items-center gap-3 print:hidden">
        <p className="mr-auto text-sm text-tertiary-foreground">What goes on each vehicle, from the orders on its trip.</p>
        <span className="text-sm text-muted-foreground">Delivery on</span>
        <DayStepper date={date} base="/app-orders/dispatch/load" />
        <PrintButton />
      </div>

      <div className="load-sheet w-full max-w-5xl space-y-8">
        <div>
          <h1 className="text-xl font-semibold">Load sheet - {day(date)}</h1>
          <p className="text-sm text-muted-foreground">
            {trips.length} {trips.length === 1 ? "vehicle" : "vehicles"} · {trips.reduce((s, t) => s + t.stops, 0)} orders on trips
          </p>
          {waiting > 0 ? (
            <p className="mt-1 text-sm font-semibold print:hidden">
              {waiting} confirmed {waiting === 1 ? "order is" : "orders are"} not on a trip yet and not counted here.{" "}
              <Link href={`/app-orders/dispatch?date=${date}`} className="underline underline-offset-2">Plan trips</Link>
            </p>
          ) : null}
        </div>

        {trips.length === 0 ? (
          <p className="text-sm text-muted-foreground">No trips planned for this day. Put the confirmed orders on trips on the Plan tab first.</p>
        ) : (
          <>
            <section className="load-trip">
              <h2 className="mb-1 text-[15px] font-semibold">Day total - all vehicles</h2>
              <LoadTable lines={total} />
            </section>
            {trips.map((t) => (
              <section key={t.id} className="load-trip border-t border-foreground/15 pt-4">
                <div className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 className="text-[15px] font-semibold">{t.route}</h2>
                  <span className="text-sm">{t.vehicleNo ? `Vehicle ${t.vehicleNo}` : "No vehicle number"}</span>
                  <span className="text-sm text-muted-foreground">{t.transporter ?? "No transporter"} · {t.stops} {t.stops === 1 ? "stop" : "stops"}</span>
                  <span className="print:hidden"><TripStatusPill status={t.status} /></span>
                  <Link href={`/app-orders/dispatch/${t.id}`} className="ml-auto text-sm underline underline-offset-2 print:hidden">Trip</Link>
                </div>
                <LoadTable lines={t.lines} />
              </section>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
