import Link from "next/link";
import { Avatar } from "@/components/profile/parts";
import { cn } from "@/lib/utils";

/*
 * The Dispatch look, shared by every tab: the same quiet, hairline style as the profile pages (no boxes around
 * sections, numbers in a row, tables with hairlines), with a few working colours only where they mean something:
 * the trip's status, delivered (green) and not delivered (amber), and the yellow plate of a commercial vehicle.
 * Map pages put their lists in a floating panel over a full-width map.
 */

export type TripStatus = "planned" | "on_the_way" | "completed" | "cancelled";

const STATUS: Record<TripStatus, { label: string; dot: string; text: string }> = {
  planned: { label: "Planned", dot: "bg-zinc-400", text: "text-foreground/70" },
  on_the_way: { label: "On the way", dot: "bg-blue-600", text: "text-blue-700" },
  completed: { label: "Completed", dot: "bg-emerald-600", text: "text-emerald-700" },
  cancelled: { label: "Cancelled", dot: "bg-zinc-300", text: "text-tertiary-foreground" },
};

/** A trip's status: a dot and a word (the dot pulses while the truck is on the road). */
export function StatusBadge({ status, className }: { status: TripStatus; className?: string }) {
  const s = STATUS[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[12px] font-medium whitespace-nowrap", s.text, className)}>
      <span className="relative flex size-2 shrink-0">
        {status === "on_the_way" ? <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-500/60" /> : null}
        <span className={cn("relative inline-flex size-2 rounded-full", s.dot)} />
      </span>
      {s.label}
    </span>
  );
}

/** A vehicle number as a (commercial, yellow) number plate. */
export function Plate({ no, className }: { no: string | null | undefined; className?: string }) {
  if (!no) return null;
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-[4px] border border-[#d8c25a] bg-[#fff3bf] px-1.5 py-px font-mono text-[11px] leading-4 font-semibold tracking-wider text-[#2a2300] uppercase", className)}>
      {no}
    </span>
  );
}

/** Someone with their initials, name and (callable) phone; "Not assigned" when there is nobody. */
export function Person({ name, phone, size = 26, sub }: { name: string | null | undefined; phone?: string | null; size?: number; sub?: React.ReactNode }) {
  if (!name) return <span className="text-[13px] text-tertiary-foreground">Not assigned</span>;
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <Avatar name={name} size={size} />
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[13px] text-foreground">{name}</span>
        {phone || sub ? (
          <span className="block truncate text-[12px] text-tertiary-foreground">
            {phone ? <a href={`tel:${phone}`} className="hover:text-foreground">{phone}</a> : null}
            {phone && sub ? " · " : null}
            {sub}
          </span>
        ) : null}
      </span>
    </span>
  );
}

type StopTone = { status: string; note?: string | null };
const tone = (s: StopTone) =>
  s.status === "delivered" ? "bg-emerald-500" : s.status === "not_delivered" ? (s.note === "Not visited" ? "bg-amber-300" : "bg-amber-500") : "bg-foreground/10";

/** A trip's stops as one segment each (green delivered, amber not, grey still to do); one bar when there are many. */
export function StopBar({ stops, className }: { stops: StopTone[]; className?: string }) {
  if (!stops.length) return null;
  if (stops.length > 32) {
    const n = (f: (s: StopTone) => boolean) => (stops.filter(f).length / stops.length) * 100;
    return (
      <div className={cn("flex h-1.5 overflow-hidden rounded-full bg-foreground/10", className)}>
        <span className="bg-emerald-500" style={{ width: `${n((s) => s.status === "delivered")}%` }} />
        <span className="bg-amber-500" style={{ width: `${n((s) => s.status === "not_delivered")}%` }} />
      </div>
    );
  }
  return (
    <div className={cn("flex h-1.5 gap-[3px]", className)}>
      {stops.map((s, i) => <span key={i} className={cn("min-w-[3px] flex-1 rounded-full", tone(s))} />)}
    </div>
  );
}

/** The same bar from counts (the Trips list knows how many, not which). */
export const stopsFrom = (c: { stops: number; delivered: number; notDelivered: number; notVisited: number }): StopTone[] => [
  ...Array.from({ length: c.delivered }, () => ({ status: "delivered" })),
  ...Array.from({ length: c.notDelivered }, () => ({ status: "not_delivered" })),
  ...Array.from({ length: c.notVisited }, () => ({ status: "not_delivered", note: "Not visited" })),
  ...Array.from({ length: Math.max(0, c.stops - c.delivered - c.notDelivered - c.notVisited) }, () => ({ status: "pending" })),
];

/** Key numbers inline (map pages, where height is precious): label then value, side by side. */
export function InlineStats({ items, className }: { items: Array<{ label: string; value: React.ReactNode; warn?: boolean }>; className?: string }) {
  return (
    <dl className={cn("flex flex-wrap items-baseline gap-x-6 gap-y-1", className)}>
      {items.map((s) => (
        <div key={s.label} className="flex items-baseline gap-2">
          <dt className="text-[12px] text-tertiary-foreground">{s.label}</dt>
          <dd className={cn("text-[15px] font-semibold tracking-tight text-foreground tabular-nums", s.warn && "text-amber-700")}>{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A choice of a few options as one pill (views, periods). For client components: it calls onChange. */
export function Segmented<T extends string>({ value, options, onChange, className }: {
  value: T; options: Array<{ value: T; label: React.ReactNode }>; onChange: (v: T) => void; className?: string;
}) {
  return (
    <div role="tablist" className={cn("inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5", className)}>
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}
          className={cn("rounded-md px-2.5 py-1 text-[12.5px] whitespace-nowrap transition-colors",
            value === o.value ? "bg-background font-medium text-foreground shadow-sm ring-1 ring-foreground/5" : "text-tertiary-foreground hover:text-foreground")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** The same pill made of links (server pages). */
export function SegmentedLinks({ value, options, className }: { value: string; options: Array<{ value: string; label: React.ReactNode; href: string }>; className?: string }) {
  return (
    <nav className={cn("inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5", className)}>
      {options.map((o) => (
        <Link key={o.value} href={o.href} aria-current={value === o.value ? "page" : undefined}
          className={cn("rounded-md px-2.5 py-1 text-[12.5px] whitespace-nowrap transition-colors",
            value === o.value ? "bg-background font-medium text-foreground shadow-sm ring-1 ring-foreground/5" : "text-tertiary-foreground hover:text-foreground")}>
          {o.label}
        </Link>
      ))}
    </nav>
  );
}

/** A section heading over a hairline, with a count and an action on the right. */
export function SectionHead({ title, count, note, action, className }: { title: string; count?: number; note?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <header className={cn("flex items-end justify-between gap-3 border-b border-border pb-2", className)}>
      <div className="min-w-0">
        <h2 className="text-[14px] font-semibold text-foreground">
          {title}{count !== undefined ? <span className="ml-1.5 font-normal tabular-nums text-tertiary-foreground">{count.toLocaleString("en-IN")}</span> : null}
        </h2>
        {note ? <p className="mt-0.5 text-[12px] text-tertiary-foreground">{note}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </header>
  );
}

/** A quiet empty state with an optional way forward. */
export function EmptyState({ title, hint, action }: { title: string; hint?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-6 py-14 text-center">
      <p className="text-[14px] font-medium text-foreground">{title}</p>
      {hint ? <p className="max-w-sm text-[13px] text-tertiary-foreground">{hint}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

/** The panel that floats over a full-width map (lists on Live and Routes, the replay bar). */
export const floating = "rounded-xl border border-foreground/10 bg-background/95 shadow-[0_12px_32px_-12px_rgba(15,23,42,0.28)] backdrop-blur-md";

/** Native inputs and selects, matched to the kit's Input. */
export const control = "h-8 rounded-lg border border-input bg-background px-2.5 text-[13px] text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/** A small square icon button (day steppers, map tools). */
export const iconButton = "inline-flex size-8 items-center justify-center rounded-lg border border-input bg-background text-foreground/80 transition-colors hover:bg-muted hover:text-foreground";

export const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
export const km = (m: number | null | undefined) => (m === null || m === undefined ? "–" : Math.abs(m) >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);
export const clock = (v: string | number | null | undefined) =>
  v === null || v === undefined ? "" : new Date(v).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" });
export const dayLabel = (ymd: string, weekday = false) =>
  new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", ...(weekday ? { weekday: "short" as const } : {}), day: "numeric", month: "short" });
export const duration = (min: number | null | undefined) =>
  min === null || min === undefined ? "–" : min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`;
