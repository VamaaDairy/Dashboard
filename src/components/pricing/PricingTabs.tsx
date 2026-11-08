import Link from "next/link";
import { Grid3x3, ListChecks, Tags, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export type PricingTab = "overview" | "skus" | "lists" | "customers";

const TABS: Array<{ key: PricingTab; href: string; label: string; icon: typeof Tags }> = [
  { key: "overview", href: "/price-list/overview", label: "Price overview", icon: Grid3x3 },
  { key: "skus", href: "/price-list", label: "SKU prices", icon: Tags },
  { key: "lists", href: "/price-list/lists", label: "Party price lists", icon: ListChecks },
  { key: "customers", href: "/price-list/customers", label: "Customer prices", icon: Users },
];

/** The Pricing pages, one tab each, under every page's header. */
export function PricingTabs({ on }: { on: PricingTab }) {
  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto border-b border-border" aria-label="Pricing">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={on === t.key ? "page" : undefined}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] font-medium",
            on === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <t.icon className="size-4" /> {t.label}
        </Link>
      ))}
    </nav>
  );
}

export const money = (n: number | null | undefined, digits = 2) =>
  n === null || n === undefined ? "—" : `₹${n.toLocaleString("en-IN", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: digits })}`;

/** Margin as a % of MRP: green when healthy, amber when thin, red when the price is above MRP. */
export function Margin({ pct, className }: { pct: number | null; className?: string }) {
  if (pct === null) return null;
  const tone = pct < 0 ? "text-destructive" : pct < 5 ? "text-amber-700" : "text-emerald-700";
  return <span className={cn("num text-[11px]", tone, className)} title="Margin below MRP">{pct}%</span>;
}

/** Where a customer's price comes from. */
export function SourceBadge({ source, list }: { source: "list" | "channel" | "product"; list?: string | null }) {
  const s = {
    list: { label: list ? `List: ${list}` : "Own list", cls: "border-primary/30 bg-primary/10 text-foreground" },
    channel: { label: "Channel price", cls: "border-border bg-muted text-muted-foreground" },
    product: { label: "Base DP", cls: "border-amber-500/30 bg-amber-500/10 text-amber-700" },
  }[source];
  return <span className={cn("inline-flex h-5 max-w-40 items-center truncate rounded-full border px-2 text-[11px] font-medium", s.cls)}>{s.label}</span>;
}
