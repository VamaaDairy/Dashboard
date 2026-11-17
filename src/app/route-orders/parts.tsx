import Link from "next/link";
import { cn } from "@/lib/utils";
import { CHANNELS } from "@/lib/route-orders/data";

/** Pieces shared by the Route orders pages. */

export const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
export const inr2 = (n: number) => `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const kg = (n: number) => `${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 1 })} kg`;

/** 40 pieces of a 24-pack: "1 + 16". A product sold singly is just its count. */
export function cases(pieces: number, pack: number) {
  const p = Number(pack) > 1 ? Number(pack) : 1;
  if (p === 1) return String(Number(pieces.toFixed(2)));
  const whole = Math.floor((pieces + 1e-9) / p);
  return `${whole} + ${Number((pieces - whole * p).toFixed(2))}`;
}

const BUYERS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All" },
  { value: "distributors", label: "Distributors" },
  { value: "retailers", label: "Retailers" },
  ...CHANNELS.map((c) => ({ value: c, label: c })),
];

export function Chip({ href, on, children }: { href: string; on: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={cn("whitespace-nowrap rounded-full border px-3 py-1 text-sm", on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}>
      {children}
    </Link>
  );
}

/** The date, who's buying, and confirmed-only. All of them stay in the URL. */
export function DayFilters({ base, date, buyer, route, confirmed }: { base: string; date: string; buyer: string; route?: string; confirmed: boolean }) {
  const href = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const all = { date, buyer, route, confirmed: confirmed ? "1" : undefined, ...over };
    for (const [k, v] of Object.entries(all)) if (v && !(k === "buyer" && v === "all")) p.set(k, v);
    return `${base}?${p}`;
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <form action={base} className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">Delivery date</span>
          <input type="date" name="date" defaultValue={date} aria-label="Delivery date" className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary" />
          {buyer !== "all" ? <input type="hidden" name="buyer" value={buyer} /> : null}
          {route ? <input type="hidden" name="route" value={route} /> : null}
          {confirmed ? <input type="hidden" name="confirmed" value="1" /> : null}
          <button className="h-9 rounded-lg border border-border px-3 text-sm hover:bg-muted">Show</button>
        </form>
        <Chip href={href({ confirmed: confirmed ? undefined : "1" })} on={confirmed}>Confirmed only</Chip>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {BUYERS.map((b) => <Chip key={b.value} href={href({ buyer: b.value })} on={buyer === b.value}>{b.label}</Chip>)}
      </div>
    </div>
  );
}

export const Notice = ({ tone, children }: { tone: "ok" | "error" | "warn"; children: React.ReactNode }) => (
  <div className={cn(
    "rounded-lg border px-3 py-2 text-sm",
    tone === "ok" && "border-emerald-600/25 bg-emerald-500/10 text-emerald-700",
    tone === "error" && "border-border-destructive bg-destructive/10 text-destructive",
    tone === "warn" && "border-border-warning bg-warning/12 text-amber-700",
  )}>{children}</div>
);
