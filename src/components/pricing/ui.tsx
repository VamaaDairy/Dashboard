import Link from "next/link";
import { cn } from "@/lib/utils";

/*
 * Pricing's look: one card split into a list and a detail, the app's own colours (logo blue as the only accent,
 * the costing pages' packing colour for packaging), solid text - secondary text is the foreground at 75%, never lighter -
 * and figures in tabular numerals.
 */

/** Secondary text: labels, codes, notes. */
export const SUB = "text-foreground/75";
/** Hairlines that are actually visible. */
export const LINE = "border-foreground/10";
/** Packing colour, as on the costing pages (lib/costing/colors COST.packing). */
export const PACK_COLOR = "#e87ba4";

export const money = (n: number | null | undefined, digits = 2) =>
  n === null || n === undefined ? "—" : `₹${n.toLocaleString("en-IN", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: digits })}`;
export const money2 = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "21.7% margin" - plain text; only a price above MRP is called out. */
export function Margin({ pct, label = "margin", className }: { pct: number | null; label?: string; className?: string }) {
  if (pct === null) return null;
  return <span className={cn("tabular-nums", pct < 0 ? "text-destructive" : SUB, className)}>{pct}% {label}</span>;
}

/** A line of figures under the tabs: "42 SKUs on sale · 3 missing a trade price ...". */
export function Summary({ items }: { items: Array<{ value: string; label: string; alert?: boolean; href?: string }> }) {
  return (
    <div className="flex flex-wrap gap-x-7 gap-y-1 py-4 text-[13px]">
      {items.map((i) => {
        const body = (
          <>
            <span className={cn("tabular-nums mr-1 font-semibold", i.alert ? "text-destructive" : "text-foreground")}>{i.value}</span>
            <span className={SUB}>{i.label}</span>
          </>
        );
        return i.href ? <Link key={i.label} href={i.href} className="hover:underline">{body}</Link> : <span key={i.label}>{body}</span>;
      })}
    </div>
  );
}

/** The list | detail card every Pricing tab is built on. */
export function Split({ list, children }: { list: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className={cn("grid overflow-hidden rounded-xl border bg-card lg:h-[calc(100vh-13.5rem)] lg:min-h-[36rem] lg:grid-cols-[23rem_minmax(0,1fr)]", LINE)}>
      <div className={cn("flex min-h-0 flex-col border-b lg:border-r lg:border-b-0", LINE)}>{list}</div>
      <section className="min-h-0 min-w-0 overflow-y-auto">{children}</section>
    </div>
  );
}

/** A section heading inside a detail, with an optional note on the right. */
export function DetailHeading({ children, note }: { children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <h3 className="mt-9 mb-2 flex items-baseline justify-between gap-3 text-[13px] font-semibold text-foreground">
      <span>{children}</span>
      {note ? <span className={cn("text-[12px] font-normal", SUB)}>{note}</span> : null}
    </h3>
  );
}

/** Table classes for the detail tables. */
export const T = {
  table: "w-full text-[13px]",
  th: cn("whitespace-nowrap border-b py-2 pl-4 text-left text-[12px] font-medium first:pl-0", LINE, SUB),
  td: cn("border-b py-2.5 pl-4 first:pl-0", LINE),
};

/** The empty right-hand side when nothing is picked. */
export function NothingPicked({ children }: { children: React.ReactNode }) {
  return <div className={cn("flex h-full min-h-60 items-center justify-center p-10 text-center text-[13px]", SUB)}>{children}</div>;
}
