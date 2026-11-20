import { haversine } from "@/lib/shop/route-plan";
import { toTrack, type Ping } from "@/lib/shop/track";
import type { StopStatus, Trip } from "./index";

/** One line of a trip's story, in time order. */
export interface TimelineRow {
  at: string;
  kind: "start" | "stop" | "gap" | "end" | "missed";
  title: string;
  detail: string | null;
  /** start, stops and the end: minutes and metres driven since the line before */
  mins: number | null;
  metres: number | null;
  /** stops: when the truck got within ARRIVED_M of the customer's pin, and how long until the stop was marked */
  arrivedAt: string | null;
  waitMins: number | null;
  status: StopStatus | null;
  seq: number | null;
}

/** Within this of the customer's pin counts as having arrived. */
const ARRIVED_M = 150;
/** No position from the phone for this long is shown as a gap. */
const GAP_MIN = 5;

const ms = (v: string | Date) => new Date(v).getTime();
const iso = (v: number | string | Date) => new Date(v).toISOString();
const ORDER: Record<TimelineRow["kind"], number> = { start: 0, gap: 1, stop: 2, end: 3, missed: 4 };

/**
 * The trip as it happened: it left, each stop in the order it was done (with the minutes and km since the one before,
 * when the truck reached the pin and how long it stayed), signal gaps, the end and any stop it never reached.
 */
export function tripTimeline(t: Trip, pings: Ping[]): TimelineRow[] {
  if (!t.startedAt) return [];
  const between = (a: number, b: number) => toTrack(pings.filter((p) => ms(p.at) >= a && ms(p.at) <= b)).metres;
  const row = (r: Partial<TimelineRow> & Pick<TimelineRow, "at" | "kind" | "title">): TimelineRow =>
    ({ detail: null, mins: null, metres: null, arrivedAt: null, waitMins: null, status: null, seq: null, ...r });
  const rows: TimelineRow[] = [row({ at: iso(t.startedAt), kind: "start", title: "Trip started", detail: t.vehicleNo ? `Vehicle ${t.vehicleNo}` : null })];

  let prev = ms(t.startedAt);
  const done = t.stops
    .filter((s) => s.status !== "pending" && s.deliveredAt && s.note !== "Not visited")
    .sort((a, b) => ms(a.deliveredAt!) - ms(b.deliveredAt!) || a.seq - b.seq);
  for (const s of done) {
    const at = ms(s.deliveredAt!);
    // when the truck got to the pin: its first position close to it since the line before
    const near = s.lat !== null && s.lng !== null
      ? pings.find((p) => ms(p.at) >= prev && ms(p.at) <= at && haversine(p, { lat: s.lat!, lng: s.lng! }) <= ARRIVED_M)
      : undefined;
    rows.push(row({
      at: iso(at), kind: "stop", seq: s.seq, status: s.status, title: `${s.seq}. ${s.buyer}`,
      detail: s.status === "delivered" ? (s.receivedBy ? `Delivered · received by ${s.receivedBy}` : "Delivered") : `Not delivered${s.note ? ` · ${s.note}` : ""}`,
      mins: Math.round((at - prev) / 60_000), metres: between(prev, at),
      arrivedAt: near ? iso(near.at) : null, waitMins: near ? Math.round((at - ms(near.at)) / 60_000) : null,
    }));
    prev = at;
  }

  // the phone sent nothing for a while (no signal, or the app was closed)
  const end = t.endedAt ? ms(t.endedAt) : Date.now();
  const marks = [ms(t.startedAt), ...pings.map((p) => ms(p.at)), ...(t.endedAt ? [end] : [])];
  for (let i = 1; i < marks.length; i++) {
    const g = marks[i] - marks[i - 1];
    if (g >= GAP_MIN * 60_000) rows.push(row({ at: iso(marks[i - 1]), kind: "gap", title: `No GPS for ${Math.round(g / 60_000)} min` }));
  }

  if (t.endedAt) {
    rows.push(row({ at: iso(end), kind: "end", title: "Trip ended", mins: Math.round((end - prev) / 60_000), metres: between(prev, end) }));
    for (const s of t.stops.filter((x) => x.note === "Not visited")) {
      rows.push(row({ at: iso(end), kind: "missed", seq: s.seq, status: s.status, title: `${s.seq}. ${s.buyer}`, detail: "Not visited" }));
    }
  }
  return rows.sort((a, b) => ms(a.at) - ms(b.at) || ORDER[a.kind] - ORDER[b.kind] || (a.seq ?? 0) - (b.seq ?? 0));
}
