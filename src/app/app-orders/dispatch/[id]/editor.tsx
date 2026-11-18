"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import type { DispatchOrder, Trip } from "@/lib/dispatch";
import { updateTripAction } from "../actions";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

type Stop = { uid: string; orderId: number; buyer: string; address: string | null; qty: number; total: number };

/** A planned trip: who drives it, the vehicle, and its stops - their order, taking one off, adding a waiting order. */
export function TripEditor({ trip, transporters, more }: { trip: Trip; transporters: Array<{ id: number; name: string; vehicleNo: string | null }>; more: DispatchOrder[] }) {
  const router = useRouter();
  const [stops, setStops] = useState<Stop[]>(trip.stops.map((s) => ({ uid: s.orderUid, orderId: s.orderId, buyer: s.buyer, address: s.address, qty: s.qty, total: s.total })));
  const [truck, setTruck] = useState(trip.transporter ? String(trip.transporter.id) : "");
  const [vehicle, setVehicle] = useState(trip.vehicleNo ?? "");
  const [name, setName] = useState(trip.route);
  const [add, setAdd] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const move = (i: number, d: number) => setStops((s) => { const x = [...s]; const [m] = x.splice(i, 1); x.splice(i + d, 0, m); return x; });
  const extra = more.filter((o) => !stops.some((s) => s.uid === o.uid));
  const save = () =>
    start(async () => {
      const r = await updateTripAction(trip.id, { orderUids: stops.map((s) => s.uid), transporterId: truck ? Number(truck) : null, vehicleNo: vehicle || null, notes: trip.notes, routeName: name });
      if (!r.ok) return setError(r.error);
      setError("");
      router.refresh();
    });
  const btn = "rounded-md p-1 text-muted-foreground hover:bg-muted disabled:opacity-30";

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-[12px] text-muted-foreground">Trip name<input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground" /></label>
        <label className="text-[12px] text-muted-foreground">Transporter
          <select value={truck} onChange={(e) => { setTruck(e.target.value); const t = transporters.find((x) => String(x.id) === e.target.value); if (t?.vehicleNo) setVehicle(t.vehicleNo); }}
            className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground">
            <option value="">Not assigned</option>
            {transporters.map((t) => <option key={t.id} value={t.id}>{t.name}{t.vehicleNo ? ` · ${t.vehicleNo}` : ""}</option>)}
          </select>
        </label>
        <label className="text-[12px] text-muted-foreground">Vehicle no.<input value={vehicle} onChange={(e) => setVehicle(e.target.value.toUpperCase())} className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 font-mono text-sm uppercase text-foreground" /></label>
      </div>

      <ol className="divide-y divide-border rounded-lg border border-border">
        {stops.map((s, i) => (
          <li key={s.uid} className="flex items-center gap-3 px-3 py-2 text-sm">
            <span className="num w-5 text-muted-foreground">{i + 1}</span>
            <span className="min-w-0 flex-1"><span className="block truncate font-medium">{s.buyer}</span><span className="block truncate text-[12px] text-muted-foreground">#{s.orderId}{s.address ? ` · ${s.address}` : ""}</span></span>
            <span className="num text-[12px] text-muted-foreground">{s.qty} pcs</span>
            <span className="num w-20 text-right">{inr(s.total)}</span>
            <button type="button" aria-label="Earlier" disabled={i === 0} onClick={() => move(i, -1)} className={btn}><ArrowUp className="size-4" /></button>
            <button type="button" aria-label="Later" disabled={i === stops.length - 1} onClick={() => move(i, 1)} className={btn}><ArrowDown className="size-4" /></button>
            <button type="button" aria-label="Take off the trip" disabled={stops.length === 1} onClick={() => setStops((x) => x.filter((y) => y.uid !== s.uid))} className={btn}><X className="size-4" /></button>
          </li>
        ))}
      </ol>

      {extra.length ? (
        <div className="flex gap-2">
          <select value={add} onChange={(e) => setAdd(e.target.value)} className="h-9 flex-1 rounded-lg border border-input bg-background px-2 text-sm">
            <option value="">Add a waiting order…</option>
            {extra.map((o) => <option key={o.uid} value={o.uid}>{o.route} · {o.buyer} · #{o.orderId} · {inr(o.total)}</option>)}
          </select>
          <button type="button" disabled={!add} onClick={() => { const o = extra.find((x) => x.uid === add); if (o) setStops((s) => [...s, { uid: o.uid, orderId: o.orderId, buyer: o.buyer, address: o.address, qty: o.qty, total: o.total }]); setAdd(""); }}
            className="h-9 rounded-lg border border-input px-3 text-sm hover:bg-muted disabled:opacity-50">Add</button>
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <button type="button" disabled={pending} onClick={save} className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60">{pending ? "Saving…" : "Save trip"}</button>
        <span className="text-[12px] text-muted-foreground">The transporter sees the stops in this order. Once they start the trip it can no longer be changed here.</span>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
