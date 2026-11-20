import Link from "next/link";
import { tripChoices, tripsBetween, type TripRow } from "@/lib/dispatch/history";
import { todayIst } from "@/lib/orders/direct";
import { cn } from "@/lib/utils";
import { TripStatusPill } from "../board";
import { TripFilters } from "./filters";

export const dynamic = "force-dynamic";

type Search = { view?: string; from?: string; to?: string; month?: string; status?: string; transporter?: string; route?: string; q?: string };
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES: TripRow["status"][] = ["planned", "on_the_way", "completed", "cancelled"];

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const km = (m: number | null) => (m === null ? "-" : Math.abs(m) >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`);
const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" });
const day = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
const span = (min: number | null) => (min === null ? "-" : min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`);
const shift = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const monthShift = (month: string, n: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};
const lastDay = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
};

/**
 * Every trip over a period, three ways: a Table with the numbers (stops, value, times, km driven against the plan and
 * off the planned road), a month Calendar, and a Board by status. Filters: period, status, transporter, route, search.
 */
export default async function TripsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const today = todayIst();
  const view = sp.view === "calendar" || sp.view === "board" ? sp.view : "table";
  const month = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : (sp.to && YMD.test(sp.to) ? sp.to : today).slice(0, 7);
  let to = sp.to && YMD.test(sp.to) ? sp.to : today;
  let from = sp.from && YMD.test(sp.from) && sp.from <= to ? sp.from : shift(to, -29);
  if (view === "calendar") {
    from = `${month}-01`;
    to = lastDay(month);
  }
  const status = STATUSES.includes(sp.status as TripRow["status"]) ? (sp.status as TripRow["status"]) : null;
  const transporterId = sp.transporter && /^\d+$/.test(sp.transporter) ? Number(sp.transporter) : null;
  const route = sp.route?.trim() || null;
  const q = sp.q?.trim() || null;
  const [rows, choices] = await Promise.all([tripsBetween({ from, to, status, transporterId, route, q }), tripChoices(from, to)]);

  // the same address with some settings changed (the calendar's months)
  const href = (patch: Partial<Search>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) p.set(k, v);
    return `?${p.toString()}`;
  };

  return (
    <div className="flex flex-col gap-4 px-4 pt-3 pb-8 md:px-6">
      <TripFilters view={view} from={from} to={to} today={today} status={status ?? ""} transporter={transporterId ? String(transporterId) : ""}
        route={route ?? ""} q={q ?? ""} transporters={choices.transporters} routes={choices.routes} />
      {view === "calendar" ? (
        <TripsCalendar rows={rows} month={month} today={today} prev={href({ month: monthShift(month, -1) })} next={href({ month: monthShift(month, 1) })} />
      ) : !rows.length ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-14 text-center text-sm text-muted-foreground">
          No trips match these filters. Trips are planned on the <Link href="/app-orders/dispatch" className="font-medium text-primary hover:underline">Plan</Link> tab.
        </div>
      ) : view === "board" ? <TripsBoard rows={rows} /> : <TripsTable rows={rows} />}
    </div>
  );
}

function TripsTable({ rows }: { rows: TripRow[] }) {
  const live = rows.filter((r) => r.status !== "cancelled");
  const sum = (f: (r: TripRow) => number) => live.reduce((s, r) => s + f(r), 0);
  const head = ["Day", "Trip", "Transporter", "Status", "Delivered", "Value", "Left – back", "Time", "Driven", "Plan", "Over plan", "Off the road"];
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[1100px] text-sm">
        <thead className="bg-muted/50 text-left text-[12px] text-muted-foreground">
          <tr>{head.map((h) => <th key={h} className="px-3 py-2 font-medium whitespace-nowrap">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border align-top hover:bg-muted/30">
              <td className="px-3 py-2 whitespace-nowrap"><Link href={`/app-orders/dispatch?date=${r.date}`} className="hover:underline">{day(r.date)}</Link></td>
              <td className="px-3 py-2">
                <Link href={`/app-orders/dispatch/${r.id}`} className="font-medium hover:underline">{r.route}</Link>
                <div className="text-[12px] text-muted-foreground">Trip {r.id}</div>
              </td>
              <td className="px-3 py-2">
                {r.transporter ?? <span className="text-muted-foreground">Not assigned</span>}
                {r.vehicleNo ? <div className="text-[12px] text-muted-foreground">{r.vehicleNo}</div> : null}
              </td>
              <td className="px-3 py-2"><TripStatusPill status={r.status} /></td>
              <td className="num px-3 py-2 whitespace-nowrap">
                {r.delivered}/{r.stops}
                {r.notDelivered ? <div className="text-[12px] text-amber-700">{r.notDelivered} not delivered</div> : null}
                {r.notVisited ? <div className="text-[12px] text-amber-700">{r.notVisited} not visited</div> : null}
              </td>
              <td className="num px-3 py-2 whitespace-nowrap">{inr(r.deliveredValue)}<div className="text-[12px] text-muted-foreground">of {inr(r.value)}</div></td>
              <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{r.startedAt ? `${clock(r.startedAt)} – ${r.endedAt ? clock(r.endedAt) : "on the road"}` : "-"}</td>
              <td className="num px-3 py-2 whitespace-nowrap">{span(r.minutes)}</td>
              <td className="num px-3 py-2 whitespace-nowrap">{km(r.drivenM)}</td>
              <td className="num px-3 py-2 whitespace-nowrap">{km(r.plannedM)}</td>
              <td className={cn("num px-3 py-2 whitespace-nowrap", (r.overPlanM ?? 0) > 0 && "text-amber-700")}>{r.overPlanM === null ? "-" : `${r.overPlanM > 0 ? "+" : ""}${km(r.overPlanM)}`}</td>
              <td className={cn("num px-3 py-2 whitespace-nowrap", (r.offRoadM ?? 0) > 0 && "text-amber-700")}>{km(r.offRoadM)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-border bg-muted/30 text-[13px] font-semibold">
          <tr>
            <td className="px-3 py-2" colSpan={4}>{live.length} {live.length === 1 ? "trip" : "trips"}{rows.length > live.length ? ` (+${rows.length - live.length} cancelled)` : ""}</td>
            <td className="num px-3 py-2">{sum((r) => r.delivered)}/{sum((r) => r.stops)}</td>
            <td className="num px-3 py-2">{inr(sum((r) => r.deliveredValue))}</td>
            <td className="px-3 py-2" colSpan={2} />
            <td className="num px-3 py-2">{km(sum((r) => r.drivenM ?? 0))}</td>
            <td className="num px-3 py-2">{km(sum((r) => r.plannedM ?? 0))}</td>
            <td className="px-3 py-2" />
            <td className="num px-3 py-2">{km(sum((r) => r.offRoadM ?? 0))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

const CHIP: Record<TripRow["status"], string> = {
  planned: "bg-muted text-foreground/80",
  on_the_way: "bg-blue-50 text-blue-800",
  completed: "bg-primary/10 text-primary",
  cancelled: "bg-muted text-muted-foreground line-through",
};

function TripsCalendar({ rows, month, today, prev, next }: { rows: TripRow[]; month: string; today: string; prev: string; next: string }) {
  const [y, m] = month.split("-").map(Number);
  const daysIn = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const cells: Array<string | null> = [...Array<null>(lead).fill(null), ...Array.from({ length: daysIn }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  while (cells.length % 7) cells.push(null);
  const byDay = new Map<string, TripRow[]>();
  for (const r of rows) byDay.set(r.date, [...(byDay.get(r.date) ?? []), r]);
  const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", { timeZone: "UTC", month: "long", year: "numeric" });
  const nav = "inline-flex size-8 items-center justify-center rounded-lg border border-input text-sm hover:bg-muted";
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Link href={prev} className={nav} aria-label="Month before">‹</Link>
        <span className="min-w-40 text-center font-semibold">{label}</span>
        <Link href={next} className={nav} aria-label="Next month">›</Link>
        <span className="ml-2 text-[12px] text-muted-foreground">{rows.length} {rows.length === 1 ? "trip" : "trips"} · click a day to plan it, a trip to open it</span>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((h) => <div key={h} className="bg-muted/60 px-2 py-1.5 text-[12px] font-medium text-muted-foreground">{h}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={`blank-${i}`} className="bg-muted/20" />;
          const list = byDay.get(d) ?? [];
          return (
            <div key={d} className={cn("min-h-28 min-w-0 bg-card p-1.5", d === today && "ring-2 ring-primary/40 ring-inset")}>
              <Link href={`/app-orders/dispatch?date=${d}`} className="text-[12px] font-semibold text-muted-foreground hover:text-foreground">{Number(d.slice(8))}</Link>
              <div className="mt-1 space-y-1">
                {list.slice(0, 4).map((t) => (
                  <Link key={t.id} href={`/app-orders/dispatch/${t.id}`} title={`${t.route} · ${t.transporter ?? "no transporter"} · ${t.delivered}/${t.stops} delivered`}
                    className={cn("block truncate rounded px-1.5 py-0.5 text-[11px] font-medium", CHIP[t.status])}>
                    {t.route} · {t.delivered}/{t.stops}
                  </Link>
                ))}
                {list.length > 4 ? <div className="px-1.5 text-[11px] text-muted-foreground">+{list.length - 4} more</div> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TripsBoard({ rows }: { rows: TripRow[] }) {
  const cols: Array<[TripRow["status"], string]> = [["planned", "Planned"], ["on_the_way", "On the way"], ["completed", "Completed"], ["cancelled", "Cancelled"]];
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cols.map(([s, label]) => {
        const list = rows.filter((r) => r.status === s);
        return (
          <section key={s} className="min-w-0">
            <h2 className="mb-2 flex items-center gap-2 text-[13px] font-semibold">{label}<span className="font-normal text-muted-foreground">{list.length}</span></h2>
            <div className="space-y-2">
              {list.length ? list.slice(0, 100).map((r) => (
                <Link key={r.id} href={`/app-orders/dispatch/${r.id}`} className="block rounded-xl border border-border bg-card p-3 hover:bg-muted/30">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 truncate font-semibold">{r.route}</span>
                    <span className="ml-auto shrink-0 text-[12px] text-muted-foreground">{day(r.date)}</span>
                  </div>
                  <div className="text-[12px] text-muted-foreground">Trip {r.id} · {r.transporter ?? "Not assigned"}{r.vehicleNo ? ` · ${r.vehicleNo}` : ""}</div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${r.stops ? ((r.delivered + r.notDelivered + r.notVisited) / r.stops) * 100 : 0}%` }} />
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 text-[12px] text-muted-foreground">
                    <span>{r.delivered}/{r.stops} delivered</span>
                    <span>{inr(r.deliveredValue)} of {inr(r.value)}</span>
                    {r.drivenM ? <span>{km(r.drivenM)}</span> : null}
                  </div>
                </Link>
              )) : <div className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-[12px] text-muted-foreground">None</div>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
