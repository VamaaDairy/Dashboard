"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MapPinOff, PackageCheck, Truck } from "lucide-react";
import { DispatchMap, type MapLine, type MapPin } from "@/components/shop/DispatchMap";
import { GREY, NAVY, ROUTE_COLOURS } from "@/components/shop/route-colors";
import { PLAN_SOLID } from "@/components/shop/RouteMap";
import type { DispatchOrder, Trip } from "@/lib/dispatch";
import type { LngLat } from "@/lib/shop/track";
import { cn } from "@/lib/utils";
import { cancelTripAction, createTripAction, previewTripRoadAction } from "./actions";
import { ScreenBox } from "./screen";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const num = (n: number) => (Number.isInteger(n) ? n.toLocaleString("en-IN") : n.toFixed(1));
const day = (ymd: string) => new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", day: "numeric", month: "short" });
const time = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" }) : null);
const drive = (s: number) => { const m = Math.round(s / 60); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; };

/** How the orders waiting for a trip are shown: grouped by route, on the map, or as one table. */
export type PlanView = "routes" | "map" | "table";

export const TRIP_STATUS: Record<Trip["status"], { label: string; cls: string }> = {
  planned: { label: "Planned", cls: "bg-muted text-muted-foreground ring-border" },
  on_the_way: { label: "On the way", cls: "bg-muted text-foreground ring-border" },
  completed: { label: "Completed", cls: "bg-primary/10 text-primary ring-border-brand" },
  cancelled: { label: "Cancelled", cls: "bg-muted text-muted-foreground ring-foreground/10" },
};

export function TripStatusPill({ status }: { status: Trip["status"] }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", TRIP_STATUS[status].cls)}>{TRIP_STATUS[status].label}</span>;
}

type Truck = { id: number; name: string; phone: string; vehicleNo: string | null };

export function DispatchBoard({ date, orders, trips, transporters, canEdit, view = "routes", plant }: {
  date: string; orders: DispatchOrder[]; trips: Trip[]; transporters: Truck[]; canEdit: boolean; view?: PlanView; plant: { name: string; lat: number; lng: number };
}) {
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

  // the road the new trip would take, asked again (after a short pause) whenever the picked orders change
  const pickKey = [...picked].sort().join(",");
  const [preview, setPreview] = useState<{ key: string; order: string[]; path: LngLat[]; metres: number; seconds: number; road: boolean } | null>(null);
  useEffect(() => {
    if (!canEdit || !pickKey) return;
    let dead = false;
    const t = setTimeout(() => {
      previewTripRoadAction(pickKey.split(","))
        .then((r) => { if (!dead && r) setPreview({ key: pickKey, ...r }); })
        .catch(() => {});
    }, 500);
    return () => { dead = true; clearTimeout(t); };
  }, [canEdit, pickKey]);
  const road = preview && preview.key === pickKey ? preview : null;
  // one colour per route, the same on the map and in the table
  const colourOf = useMemo(() => {
    const names = [...new Set(orders.map((o) => o.route))].sort();
    const m = new Map(names.map((n, i) => [n, ROUTE_COLOURS[i % ROUTE_COLOURS.length]]));
    return (route: string) => m.get(route) ?? NAVY;
  }, [orders]);
  const setView = (v: PlanView) => {
    const q = new URLSearchParams(window.location.search);
    if (v === "routes") q.delete("view");
    else q.set("view", v);
    router.push(`${window.location.pathname}?${q.toString()}`);
  };

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

      <div className={cn("grid gap-4", view === "map" ? "xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" : "xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]")}>
        <section className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-[15px] font-semibold">Waiting for a trip</h2>
            <div className="ml-auto inline-flex rounded-lg border border-input p-0.5" role="tablist" aria-label="View">
              {(["routes", "map", "table"] as const).map((v) => (
                <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}
                  className={cn("rounded-md px-3 py-1 text-[13px] capitalize", view === v ? "bg-foreground font-semibold text-background" : "text-muted-foreground hover:text-foreground")}>
                  {v}
                </button>
              ))}
            </div>
          </div>
          {!routes.length ? (
            <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
              <PackageCheck className="mx-auto mb-2 size-6" />
              {orders.length ? "Every confirmed order is on a trip." : "No confirmed orders for this day yet. Confirm them on the Orders page first."}
            </div>
          ) : view === "map" ? (
            <PlanMap plant={plant} waiting={waiting} trips={trips} picked={picked} order={road?.order ?? null} toggle={toggle} colourOf={colourOf} path={road?.path ?? null} canEdit={canEdit} />
          ) : view === "table" ? (
            <WaitingTable waiting={waiting} picked={picked} toggle={toggle} setPicked={setPicked} canEdit={canEdit} colourOf={colourOf} />
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
                          <span className="block truncate text-[12px] text-muted-foreground">#{o.orderId} · ordered {day(o.orderDate)} · for {day(o.deliveryDate)}{o.buyerCode ? ` · ${o.buyerCode}` : ""}{o.address ? ` · ${o.address}` : ""}</span>
                        </span>
                        {o.lat === null ? <span title="No map pin for this customer" className="text-muted-foreground"><MapPinOff className="size-4" /></span> : null}
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
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="text-sm font-semibold">New trip · {picked.length} {picked.length === 1 ? "stop" : "stops"} · {inr(pickedOrders.reduce((s, o) => s + o.total, 0))}</span>
                <span className="text-[12px] text-muted-foreground">
                  {road ? (road.road ? `${(road.metres / 1000).toFixed(1)} km by road from the plant, about ${drive(road.seconds)} of driving` : "No road data now: shown in straight lines")
                    : pickedOrders.some((o) => o.lat !== null) ? "Working out the road…" : "None of these has a map pin"}
                </span>
              </div>
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
                <span className="text-[12px] text-muted-foreground">Stops go in the shortest way round from the plant by road; change the order on the trip if needed.</span>
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
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
                  {t.transporter ? <>{t.transporter.name} · {t.transporter.phone}</> : <span className="text-muted-foreground">No transporter yet</span>}
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
                      className="h-8 rounded-lg border border-input px-3 text-[13px] text-destructive hover:bg-muted">Cancel trip</button>
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

/** The waiting orders on the map, coloured by route: click one to add it to the new trip (numbered in road order). */
function PlanMap({ plant, waiting, trips, picked, order, toggle, colourOf, path, canEdit }: {
  plant: { name: string; lat: number; lng: number };
  waiting: DispatchOrder[];
  trips: Trip[];
  picked: string[];
  /** the picked orders in the trip's road order, once the preview has it */
  order: string[] | null;
  toggle: (uid: string) => void;
  colourOf: (route: string) => string;
  path: LngLat[] | null;
  canEdit: boolean;
}) {
  const pins = useMemo(() => {
    const seq = new Map((order ?? picked).filter((u) => picked.includes(u)).map((u, i) => [u, i + 1]));
    const out: MapPin[] = [{ id: "plant", lat: plant.lat, lng: plant.lng, kind: "pill", color: NAVY, label: "Plant", popup: plant.name }];
    for (const t of trips) {
      for (const s of t.stops) {
        if (s.lat === null || s.lng === null) continue;
        out.push({ id: `t${s.id}`, lat: s.lat, lng: s.lng, kind: "num", label: String(s.seq), color: GREY, hollow: true, dim: true, popup: `${t.route} (trip ${t.id}), stop ${s.seq}: ${s.buyer}` });
      }
    }
    for (const o of waiting) {
      if (o.lat === null || o.lng === null) continue;
      const n = seq.get(o.uid);
      const popup = `${o.buyer} · #${o.orderId} · ${o.route} · ${num(o.qty)} pcs · ${inr(o.total)}${canEdit ? (n ? " · click to take it off the new trip" : " · click to add it to the new trip") : ""}`;
      out.push(n
        ? { id: `o${o.uid}`, lat: o.lat, lng: o.lng, kind: "num", label: String(n), color: NAVY, top: true, popup }
        : { id: `o${o.uid}`, lat: o.lat, lng: o.lng, kind: "dot", color: colourOf(o.route), label: waiting.length <= 40 ? o.buyer : undefined, popup });
    }
    return out;
  }, [plant, waiting, trips, picked, order, colourOf, canEdit]);
  const lines: MapLine[] = useMemo(() => (path && path.length > 1 ? [{ id: "preview", paths: [path], color: PLAN_SOLID, width: 4.5 }] : []), [path]);
  const noPin = waiting.filter((o) => o.lat === null || o.lng === null);
  return (
    <div className="space-y-2">
      <ScreenBox className="rounded-xl border border-border" min={420}>
        <DispatchMap lines={lines} pins={pins} onPin={(id) => { if (canEdit && id.startsWith("o")) toggle(id.slice(1)); }} />
      </ScreenBox>
      <p className="text-[12px] text-muted-foreground">
        {canEdit ? "Click an order to add it to the new trip; the numbers are the order the truck will reach them. " : ""}Grey numbers are stops already on a trip.
        {noPin.length ? ` ${noPin.length} ${noPin.length === 1 ? "order has" : "orders have"} no map pin: pick ${noPin.length === 1 ? "it" : "them"} in the Routes or Table view.` : ""}
      </p>
    </div>
  );
}

type SortKey = "buyer" | "route" | "orderId" | "qty" | "total" | "pin";

/** The waiting orders as one table, sortable by any column, with a box to pick each (or all). */
function WaitingTable({ waiting, picked, toggle, setPicked, canEdit, colourOf }: {
  waiting: DispatchOrder[];
  picked: string[];
  toggle: (uid: string) => void;
  setPicked: (uids: string[]) => void;
  canEdit: boolean;
  colourOf: (route: string) => string;
}) {
  const [sort, setSort] = useState<{ k: SortKey; up: boolean }>({ k: "route", up: true });
  const rows = useMemo(() => {
    const cmp = (a: DispatchOrder, b: DispatchOrder): number => {
      switch (sort.k) {
        case "buyer": return a.buyer.localeCompare(b.buyer);
        case "orderId": return a.orderId - b.orderId;
        case "qty": return a.qty - b.qty;
        case "total": return a.total - b.total;
        case "pin": return Number(a.lat === null) - Number(b.lat === null);
        default: return a.route.localeCompare(b.route) || a.buyer.localeCompare(b.buyer);
      }
    };
    return [...waiting].sort((a, b) => (sort.up ? cmp(a, b) : -cmp(a, b)));
  }, [waiting, sort]);
  const all = waiting.length > 0 && waiting.every((o) => picked.includes(o.uid));
  const head = (k: SortKey, label: string, right = false) => (
    <th className={cn("px-3 py-2 font-medium", right && "text-right")}>
      <button type="button" onClick={() => setSort((x) => ({ k, up: x.k === k ? !x.up : true }))} className="hover:text-foreground">
        {label}{sort.k === k ? (sort.up ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-muted/40 text-left text-[12px] text-muted-foreground">
          <tr>
            {canEdit ? (
              <th className="w-8 px-3 py-2">
                <input type="checkbox" checked={all} onChange={() => setPicked(all ? [] : waiting.map((o) => o.uid))} className="size-4 accent-primary" aria-label="All orders" />
              </th>
            ) : null}
            {head("buyer", "Customer")}{head("route", "Route")}{head("orderId", "Order")}{head("qty", "Pcs", true)}{head("total", "Value", true)}{head("pin", "Map pin")}
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.uid} className={cn("border-t border-border", picked.includes(o.uid) && "bg-primary/5")}>
              {canEdit ? (
                <td className="px-3 py-2"><input type="checkbox" checked={picked.includes(o.uid)} onChange={() => toggle(o.uid)} className="size-4 accent-primary" aria-label={`Pick ${o.buyer}`} /></td>
              ) : null}
              <td className="px-3 py-2">
                <div className="font-medium">{o.buyer}</div>
                <div className="text-[12px] text-muted-foreground">{[o.buyerCode, o.address].filter(Boolean).join(" · ")}</div>
              </td>
              <td className="px-3 py-2 whitespace-nowrap"><span className="mr-1.5 inline-block size-2.5 rounded-full align-middle" style={{ background: colourOf(o.route) }} />{o.route}</td>
              <td className="px-3 py-2 whitespace-nowrap">#{o.orderId}<div className="text-[12px] text-muted-foreground">ordered {day(o.orderDate)} · for {day(o.deliveryDate)}</div></td>
              <td className="num px-3 py-2 text-right">{num(o.qty)}</td>
              <td className="num px-3 py-2 text-right">{inr(o.total)}</td>
              <td className="px-3 py-2">{o.lat === null ? <span className="inline-flex items-center gap-1 text-amber-700"><MapPinOff className="size-3.5" />No pin</span> : <span className="text-muted-foreground">Yes</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
