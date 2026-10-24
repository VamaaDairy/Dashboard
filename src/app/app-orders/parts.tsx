import Link from "next/link";
import { Search } from "lucide-react";
import { Pill } from "@/components/cn/ui";
import { cn } from "@/lib/utils";
import { STATUS_LABEL } from "@/lib/shop/pricing";

/** Pieces shared by the App orders pages. */

export const KINDS = [
  { key: "d2c", href: "/app-orders/d2c", label: "D2C", long: "D2C - home delivery" },
  { key: "retailers", href: "/app-orders/retailers", label: "Retailers", long: "Retailers" },
  { key: "distributors", href: "/app-orders/distributors", label: "Distributors", long: "Distributors" },
] as const;
export type KindKey = (typeof KINDS)[number]["key"];

export const when = (d: Date | string) =>
  new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
export const dateOnly = (d: Date | string) =>
  new Date(d).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" });

export const qty = (n: number) => (Number.isInteger(Number(n)) ? String(Number(n)) : Number(n).toFixed(2));

/** Overview / D2C / Retailers / Distributors, as tabs under the page header. */
export function KindTabs({ active, counts }: { active: KindKey | "overview"; counts?: Partial<Record<KindKey, number>> }) {
  const tabs = [{ key: "overview", href: "/app-orders", label: "Overview" }, ...KINDS];
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-border">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={cn(
            "-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm",
            active === t.key ? "border-primary font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
          {counts && t.key !== "overview" && counts[t.key as KindKey] ? (
            <span className="rounded-full bg-muted px-1.5 text-[11px] font-semibold text-muted-foreground">{counts[t.key as KindKey]}</span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}

export const D2cStatus = ({ status }: { status: string }) => <Pill tone="neutral">{STATUS_LABEL[status] ?? status}</Pill>;

export function TradeStatus({ status }: { status: string }) {
  return <Pill tone="neutral">{status}</Pill>;
}

/** "Retailer app" / "Distributor app" / "Sales officer <name>": how a trade order came in. */
export function placedVia(o: { appKind: string | null; bookedBy: string | null }) {
  if (!o.appKind) return "Portal";
  if (o.appKind === "salesman") return `Sales officer${o.bookedBy ? ` ${o.bookedBy}` : ""}`;
  return o.appKind === "retailer" ? "Retailer app" : "Distributor app";
}

/** Status chips (links) plus a search box; both keep each other in the URL. */
export function Filters({ base, statuses, status, q, placeholder }: {
  base: string;
  statuses: Array<{ value: string; label: string; n?: number }>;
  status?: string;
  q?: string;
  placeholder: string;
}) {
  const href = (st?: string) => {
    const p = new URLSearchParams();
    if (st) p.set("status", st);
    if (q) p.set("q", q);
    return p.size ? `${base}?${p}` : base;
  };
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap gap-1.5 text-sm">
        {[{ value: "", label: "All" }, ...statuses].map((s) => (
          <Link
            key={s.value}
            href={href(s.value || undefined)}
            className={cn(
              "rounded-full border px-3 py-1",
              (status ?? "").toLowerCase() === s.value.toLowerCase() ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted",
            )}
          >
            {s.label}
            {s.n !== undefined ? <span className="ml-1 opacity-70">{s.n}</span> : null}
          </Link>
        ))}
      </div>
      <form action={base} className="relative md:w-80">
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          name="q"
          defaultValue={q}
          placeholder={placeholder}
          className="h-9 w-full rounded-lg border border-input bg-background pr-3 pl-8 text-sm outline-none focus:border-primary"
        />
      </form>
    </div>
  );
}

/** Label / value line for the detail panels; empty values are left out. */
export function Field({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  if (children === null || children === undefined || children === "") return null;
  return (
    <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-3 px-4 py-2 text-[13px]">
      <dt className="text-tertiary-foreground">{label}</dt>
      <dd className={cn("min-w-0 break-words font-medium text-foreground", mono && "font-mono text-[12px]")}>{children}</dd>
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[12px] text-tertiary-foreground">{label}</div>
      <div className="num text-lg font-semibold text-foreground">{value}</div>
      {sub ? <div className="text-[11px] text-tertiary-foreground">{sub}</div> : null}
    </div>
  );
}
