"use client";

import { Panel, PeriodBar, Tiles } from "@/components/dash/Dash";
import { BarList, CalendarHeatmap, ColumnChart, Donut, GAIA, MatrixHeatmap, StackedBars, StackedColumns } from "@/components/farmers/charts";
import type { DispatchReport } from "@/lib/dispatch/report";

const n = (v: number) => v.toLocaleString("en-IN");
const inr = (v: number) => `₹${Math.round(v).toLocaleString("en-IN")}`;
const km = (m: number) => (m >= 1000 ? `${(m / 1000).toLocaleString("en-IN", { maximumFractionDigits: 1 })} km` : `${m} m`);
const hours = (min: number | null) => (min === null ? "-" : min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`);
const hourLabel = (h: number) => (h === 0 ? "12 am" : h < 12 ? `${h} am` : h === 12 ? "12 pm" : `${h - 12} pm`);

/** The Dispatch reports: totals, stops by day, outcomes and reasons, routes, hours, and each transporter (charts run in the browser). */
export function ReportView({ r, today }: { r: DispatchReport; today: string }) {
  const { from, to } = r;
  const t = r.totals;
  const notDone = t.notDelivered + t.notVisited;

  // the working hours only: the first to the last hour anything was marked (at least 7 am to 7 pm)
  const marked = r.byHour.map((v, h) => ({ v, h })).filter((x) => x.v > 0).map((x) => x.h);
  const h0 = Math.min(7, ...marked), h1 = Math.max(19, ...marked);

  return (
    <div className="flex flex-col gap-4 px-4 pt-3 pb-10 md:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <p className="mr-auto text-sm text-tertiary-foreground">How the trips went: stops delivered or not, why, by route, by hour and by transporter. Cancelled trips are left out.</p>
        <PeriodBar from={from} to={to} today={today} />
      </div>

      <Tiles items={[
        { label: "Trips", value: n(t.trips), note: t.avgStops !== null ? `${t.avgStops} stops each` : undefined },
        { label: "Stops", value: n(t.stops), note: `${n(t.delivered)} delivered` },
        { label: "Delivered", value: t.deliveredPct === null ? "-" : `${t.deliveredPct}`, unit: t.deliveredPct === null ? undefined : "%", note: notDone ? `${n(notDone)} not (${n(t.notVisited)} not visited)` : "of the stops done" },
        { label: "Value delivered", value: inr(t.deliveredValue), note: `of ${inr(t.value)} sent out` },
        { label: "Driven", value: km(t.drivenM), note: t.offRoadM ? `${km(t.offRoadM)} off the planned road` : "ended trips with GPS" },
        { label: "Time", value: hours(t.avgTripMin), note: t.avgStopMin !== null ? `a trip; ${t.avgStopMin} min a stop` : "a trip, on average" },
      ]} />

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Stops by day" description="Delivered, and not delivered or not visited, by the trip's day." className="xl:col-span-2">
          <StackedColumns days={r.days} series={[{ label: "Delivered", color: GAIA.green }, { label: "Not delivered", color: GAIA.orange }]} values={r.byDay} unit="stops" />
        </Panel>
        <Panel title="Outcomes" description="Every stop done in the period.">
          <Donut
            slices={[
              { label: "Delivered", value: t.delivered, color: GAIA.green },
              { label: "Not delivered", value: t.notDelivered, color: GAIA.orange },
              { label: "Not visited", value: t.notVisited, color: GAIA.muted },
            ]}
            centre={n(t.delivered + notDone)}
            centreLabel="stops done"
          />
        </Panel>

        <Panel title="By route" description="Stops delivered and not, per route." className="xl:col-span-2">
          {r.byRoute.length ? (
            <StackedBars
              rows={r.byRoute.map((x) => ({ key: x.route, label: x.route, parts: [x.delivered, x.notDone], total: inr(x.value) }))}
              series={[{ label: "Delivered", color: GAIA.green }, { label: "Not delivered", color: GAIA.orange }]}
            />
          ) : <p className="text-sm text-muted-foreground">No stops in this period.</p>}
        </Panel>
        <Panel title="Why not delivered" description="The reasons transporters gave.">
          {r.reasons.length ? <BarList items={r.reasons} color={GAIA.orange} /> : <p className="text-sm text-muted-foreground">Every stop done was delivered.</p>}
        </Panel>

        <Panel title="When stops are done" description="Stops marked delivered or not, by the hour of the day.">
          <ColumnChart
            data={Array.from({ length: h1 - h0 + 1 }, (_, i) => h0 + i).map((h) => ({ key: String(h), label: hourLabel(h), value: r.byHour[h], tip: [{ label: "stops", value: n(r.byHour[h]) }] }))}
            color={GAIA.blue}
            unit="stops"
          />
        </Panel>
        <Panel title="Trips per day" className="xl:col-span-2">
          <CalendarHeatmap from={from} to={to} unit="trips" emptyLabel="no trips"
            days={r.days.map((d) => ({ day: d, value: r.tripsPerDay[d] || null, tip: [{ label: "trips", value: n(r.tripsPerDay[d] ?? 0) }] }))} />
        </Panel>

        <Panel title="Delivered by route, day by day" className="xl:col-span-3">
          {r.routeDays.length ? (
            <MatrixHeatmap rows={r.routeDays.map((x) => ({ key: x.route, label: x.route, cells: x.cells }))} days={r.days} unit="stops" emptyLabel="none" />
          ) : <p className="text-sm text-muted-foreground">No stops in this period.</p>}
        </Panel>
      </div>

      <Panel title="By transporter">
        {r.byTransporter.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-left text-[12px] text-muted-foreground">
                <tr>{["Transporter", "Trips", "Stops", "Delivered", "Driven", "Km a trip", "Min a stop", "Off the road", "Last trip"].map((h) => <th key={h} className="px-2 py-1.5 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {r.byTransporter.map((x) => (
                  <tr key={x.name} className="border-t border-border">
                    <td className="px-2 py-2 font-medium">{x.name}</td>
                    <td className="num px-2 py-2">{n(x.trips)}</td>
                    <td className="num px-2 py-2">{n(x.stops)}</td>
                    <td className="num px-2 py-2">{n(x.delivered)}{x.pct !== null ? <span className="text-muted-foreground"> · {x.pct}%</span> : null}</td>
                    <td className="num px-2 py-2">{km(x.drivenM)}</td>
                    <td className="num px-2 py-2">{x.kmTrips ? km(Math.round(x.drivenM / x.kmTrips)) : "-"}</td>
                    <td className="num px-2 py-2">{x.minPerStop ?? "-"}</td>
                    <td className={x.offRoadM ? "num px-2 py-2 text-amber-700" : "num px-2 py-2"}>{km(x.offRoadM)}</td>
                    <td className="px-2 py-2 text-muted-foreground">{x.last}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm text-muted-foreground">No trips in this period.</p>}
      </Panel>
    </div>
  );
}
