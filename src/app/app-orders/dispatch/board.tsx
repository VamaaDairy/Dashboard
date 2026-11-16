"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MapPinOff, PackageCheck, Truck } from "lucide-react";
import type { DispatchOrder, Trip } from "@/lib/dispatch";
import { cn } from "@/lib/utils";
import { cancelTripAction, createTripAction } from "./actions";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const num = (n: number) => (Number.isInteger(n) ? n.toLocaleString("en-IN") : n.toFixed(1));
const time = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" }) : null);

export const TRIP_STATUS: Record<Trip["status"], { label: string; cls: string }> = {
  planned: { label: "Planned", cls: "bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-950/40 dark:text-sky-300" },
  on_the_way: { label: "On the way", cls: "bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-300" },
  completed: { label: "Completed", cls: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-300" },
  cancelled: { label: "Cancelled", cls: "bg-muted text-muted-foreground ring-foreground/10" },
};

export function TripStatusPill({ status }: { status: Trip["status"] }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", TRIP_STATUS[status].cls)}>{TRIP_STATUS[status].label}</span>;
}

type Truck = { id: number; name: string; phone: string; vehicleNo: string | null };

export function DispatchBoard({ date, orders, trips, transporters, canEdit }: { date: string; orders: DispatchOrder[]; trips: Trip[]; transporters: Truck[]; canEdit: boolean }) {
  const router = useRouter();
  const waiting = orders.filter((o) => o.tripId === null);
  const routes = useMemo(() => {
    const m = new Map<string, DispatchOrder[]>();
    for (const o of waiting) m.set(o.route, [...(m.get(o.route) ?? []), o]);
    return [...m];
  }, [waiting]);
  const [picked, setPicked] = useState<string[]>([]);
  const [truck, setTruck] = useState<string>("");
  const [vehicle, setVehicle] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const pickedOrders = waiting.filter((o) => picked.includes(o.uid));
  const routeOf = pickedOrders[0]?.route ?? "";
  const toggle = (uid: string) => setPicked((p) => (p.includes(uid) ? p.filter((x) => x !== uid) : [...p, uid]));
  const pickRoute = (list: DispatchOrder[]) => {
    const all = list.every((o) => picked.includes(o.uid));
    setPicked((p) => (all ? p.filter((x) => !list.some((o) => o.uid === x)) : [...new Set([...p, ...list.map((o) => o.uid)])]));
    if (!name) setName(list[0].route);
  };

  const plan = () =>
    start(async () => {
      const first = pickedOrders[0];
      const r = await createTripAction({
        date, routeId: first?.routeId ?? null, routeName: name || routeOf || "Trip", orderUids: picked,
        transporterId: truck ? Number(truck) : null, vehicleNo: vehicle || null, notes: null,
      });
      if (!r.ok) return setError(r.error);
      setError(""); setPicked([]); setName(""); setVehicle(""); setTruck("");
      router.refresh();
    });

  const onTrip = orders.length - waiting.length;
  const delivered = trips.reduce((s, t) => s + t.stops.filter((x) => x.status === "delivered").length, 0);
  const stops = trips.reduce((s, t) => s + t.stops.length, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Confirmed orders", num(orders.length), inr(orders.reduce((s, o) => s + o.total, 0))],
          ["Waiting for a trip", num(waiting.length), `${routes.length} ${routes.length === 1 ? "route" : "routes"}`],
          ["On trips", num(onTrip), `${trips.length} ${trips.length === 1 ? "trip" : "trips"}, ${trips.filter((t) => t.status === "on_the_way").length} on the road`],
          ["Delivered", `${num(delivered)} / ${num(stops)}`, "stops"],
        ].map(([l, v, sub]) => (
          <div key={l} className="rounded-xl border border-border bg-card px-4 py-3">
            <div className="text-[12px] text-muted-foreground">{l}</div>
            <div className="num mt-0.5 text-xl font-semibold">{v}</div>
            <div className="text-[11px] text-muted-foreground">{sub}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="space-y-3">
          <h2 className="text-[15px] font-semibold">Waiting for a trip</h2>
          {!routes.length ? (
            <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
              <PackageCheck className="mx-auto mb-2 size-6" />
              {orders.length ? "Every confirmed order is on a trip." : "No confirmed orders for this day yet. Confirm them on the Orders page first."}
            </div>
          ) : routes.map(([route, list]) => {
            const all = list.every((o) => picked.includes(o.uid));
            return (
              <div key={route} className="overflow-hidden rounded-xl border border-border bg-card">
                <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-4 py-2">
                  {canEdit ? <input type="checkbox" checked={all} onChange={() => pickRoute(list)} className="size-4 accent-primary" aria-label={`All of ${route}`} /> : null}
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{route}</div>
                    <div className="text-[12px] text-muted-foreground">{list.length} {list.length === 1 ? "order" : "orders"} · {num(list.reduce((s, o) => s + o.qty, 0))} pcs · {inr(list.reduce((s, o) => s + o.total, 0))}</div>
                  </div>
                </div>
                <ul className="divide-y divide-border">
                  {list.map((o) => (
                    <li key={o.uid}>
                      <label className={cn("flex items-center gap-3 px-4 py-2 text-sm", canEdit && "cursor-pointer hover:bg-muted/40")}>
                        {canEdit ? <input type="checkbox" checked={picked.includes(o.uid)} onChange={() => toggle(o.uid)} className="size-4 accent-primary" /> : null}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{o.buyer}</span>
                          <span className="block truncate text-[12px] text-muted-foreground">#{o.orderId}{o.buyerCode ? ` · ${o.buyerCode}` : ""}{o.address ? ` · ${o.address}` : ""}</span>
                        </span>
                        {o.lat === null ? <span title="No map pin for this customer" className="text-amber-600"><MapPinOff className="size-4" /></span> : null}
                        <span className="num w-16 text-right text-[12px] text-muted-foreground">{num(o.qty)} pcs</span>
                        <span className="num w-20 text-right font-medium">{inr(o.total)}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}

          {canEdit && picked.length ? (
            <div className="sticky bottom-3 z-10 space-y-2 rounded-xl border border-primary/30 bg-card p-3 shadow-lg">
              <div className="text-sm font-semibold">New trip · {picked.length} {picked.length === 1 ? "stop" : "stops"} · {inr(pickedOrders.reduce((s, o) => s + o.total, 0))}</div>
              <div className="grid gap-2 sm:grid-cols-3">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder={routeOf || "Trip name"} className="h-9 rounded-lg border border-input bg-background px-3 text-sm" />
                <select value={truck} onChange={(e) => { setTruck(e.target.value); const t = transporters.find((x) => String(x.id) === e.target.value); if (t?.vehicleNo && !vehicle) setVehicle(t.vehicleNo); }}
                  className="h-9 rounded-lg border border-input bg-background px-2 text-sm">
                  <option value="">Transporter (assign later)</option>
                  {transporters.map((t) => <option key={t.id} value={t.id}>{t.name}{t.vehicleNo ? ` · ${t.vehicleNo}` : ""}</option>)}
                </select>
                <input value={vehicle} onChange={(e) => setVehicle(e.target.value.toUpperCase())} placeholder="Vehicle no." className="h-9 rounded-lg border border-input bg-background px-3 text-sm uppercase" />
              </div>
              <div className="flex items-center gap-2">
                <button type="button" disabled={pending} onClick={plan} className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60">{pending ? "Planning…" : "Plan trip"}</button>
                <button type="button" onClick={() => setPicked([])} className="h-9 rounded-lg border border-input px-3 text-sm hover:bg-muted">Clear</button>
                <span className="text-[12px] text-muted-foreground">Stops go in the order shown; change it on the trip.</span>
              </div>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
            </div>
          ) : null}
        </section>

        <section className="space-y-3">
          <h2 className="text-[15px] font-semibold">Trips</h2>
          {!trips.length ? (
            <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
              <Truck className="mx-auto mb-2 size-6" />No trips for this day yet. Tick orders on the left to plan one.
            </div>
          ) : trips.map((t) => {
            const done = t.stops.filter((s) => s.status !== "pending").length;
            return (
              <div key={t.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/app-orders/dispatch/${t.id}`} className="font-semibold hover:underline">{t.route}</Link>
                  <TripStatusPill status={t.status} />
                  <span className="text-[12px] text-muted-foreground">Trip {t.id}</span>
                  <span className="ml-auto num text-sm font-medium">{inr(t.total)}</span>
                </div>
                <div className="mt-1 text-[13px] text-muted-foreground">
                  {t.transporter ? <>{t.transporter.name} · {t.transporter.phone}</> : <span className="text-amber-700 dark:text-amber-400">No transporter yet</span>}
                  {t.vehicleNo ? <> · <span className="font-mono">{t.vehicleNo}</span></> : null}
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${t.stops.length ? (done / t.stops.length) * 100 : 0}%` }} />
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-3 text-[12px] text-muted-foreground">
                  <span>{done}/{t.stops.length} stops done</span>
                  {t.startedAt ? <span>Left {time(t.startedAt)}</span> : null}
                  {t.endedAt ? <span>Back {time(t.endedAt)}</span> : null}
                </div>
                <div className="mt-3 flex gap-2">
                  <Link href={`/app-orders/dispatch/${t.id}`} className="inline-flex h-8 items-center rounded-lg border border-input px-3 text-[13px] hover:bg-muted">{t.status === "on_the_way" ? "Track" : "Open"}</Link>
                  {canEdit && (t.status === "planned" || t.status === "on_the_way") ? (
                    <button type="button" disabled={pending}
                      onClick={() => { if (window.confirm("Cancel this trip? Its orders go back to waiting.")) start(async () => { const r = await cancelTripAction(t.id); if (!r.ok) window.alert(r.error); router.refresh(); }); }}
                      className="h-8 rounded-lg border border-input px-3 text-[13px] text-red-600 hover:bg-muted">Cancel trip</button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}
