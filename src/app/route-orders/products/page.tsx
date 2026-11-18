import { Fragment } from "react";
import Link from "next/link";
import { Boxes } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { dayLines, filterLines, listRoutes, readDateBy, validDate, type DayLine } from "@/lib/route-orders/data";
import { DayFilters, cases, inr, kg } from "../parts";
import { AutoRefresh } from "../sheet";
import { CategorySummary } from "../category-summary";
import { labelOf, productLabels, type ProductLabel } from "@/lib/products/names";
import { ProductCell } from "@/components/products/Product";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const category = (l: DayLine) => l.party?.channel || "Not matched";

/**
 * The demand sheet - what to make and load for the day, live: each product's quantity by route (or by customer
 * category), split into confirmed and still pending, and each product opening to its quantity per customer. Only
 * distributors' (and other direct customers') orders count: a retailer's order is on its distributor, whose own
 * order already covers it. The day is the delivery date, or the order date.
 */
export default async function ProductTotalsPage({ searchParams }: { searchParams: Promise<{ date?: string; buyer?: string; confirmed?: string; by?: string; cols?: string }> }) {
  const sp = await searchParams;
  const date = validDate(sp.date);
  const buyer = sp.buyer || "all";
  const confirmed = sp.confirmed === "1";
  const by = readDateBy(sp.by);
  const byCategory = sp.cols === "category";
  const [all, routes, labels] = await Promise.all([dayLines(date, by), listRoutes(), productLabels()]);
  const lines = filterLines(all, { buyer: buyer === "retailers" ? "all" : buyer, confirmed }).filter((l) => !l.retail);

  const colOf = (l: DayLine) => (byCategory ? category(l) : l.routeName ?? "No route");
  const rows = new Map<string, {
    label: ProductLabel; name: string; category: string; pack: number; sort: number;
    byCol: Map<string, number>; qty: number; confirmedQty: number; kg: number; value: number;
    customers: Map<string, { name: string; route: string; qty: number; pending: boolean }>;
  }>();
  for (const l of lines) {
    const key = l.product ? `p${l.product.sku_no}` : `s${l.sku}`;
    let r = rows.get(key);
    if (!r) {
      const label = labelOf(labels, l.sku, l.product?.name ?? l.skuName);
      r = { label, name: label.name, category: l.product?.category ?? "Not in master", pack: Number(l.product?.pack_size ?? 1), sort: l.product?.sort ?? 9999,
        byCol: new Map(), qty: 0, confirmedQty: 0, kg: 0, value: 0, customers: new Map() };
      rows.set(key, r);
    }
    const col = colOf(l);
    r.byCol.set(col, (r.byCol.get(col) ?? 0) + l.qty);
    r.qty += l.qty;
    if (l.status.toLowerCase() === "confirmed") r.confirmedQty += l.qty;
    r.kg += l.qty * Number(l.product?.weight_kg ?? 0);
    r.value += l.amount;
    const ck = l.party ? `p${l.party.id}` : l.firmUid;
    const c = r.customers.get(ck) ?? { name: l.party?.name ?? l.firmName, route: l.routeName ?? "No route", qty: 0, pending: false };
    c.qty += l.qty;
    if (l.status.toLowerCase() !== "confirmed") c.pending = true;
    r.customers.set(ck, c);
  }
  const table = [...rows.values()].sort((a, b) => a.sort - b.sort);
  const used = new Set(lines.map(colOf));
  const heads = byCategory
    ? [...used].sort((a, b) => (a === "Not matched" ? 1 : 0) - (b === "Not matched" ? 1 : 0) || a.localeCompare(b))
    : [...routes.map((r) => r.name).filter((n) => used.has(n)), ...(used.has("No route") ? ["No route"] : [])];
  const categories = [...new Set(table.map((r) => r.category))];
  const pendingOrders = new Set(lines.filter((l) => l.status.toLowerCase() !== "confirmed").map((l) => l.orderUid)).size;

  const keep = { cols: byCategory ? "category" : undefined };
  const colHref = (cat: boolean) => {
    const p = new URLSearchParams({ date });
    if (buyer !== "all") p.set("buyer", buyer);
    if (confirmed) p.set("confirmed", "1");
    if (by === "order") p.set("by", "order");
    if (cat) p.set("cols", "category");
    return `/route-orders/products?${p}`;
  };
  const span = heads.length + 7;

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-4">
        <PageHeader
          icon={Boxes}
          title="Demand sheet"
          subtitle="What to make and load, live as orders come in - confirmed and still pending. Distributors' orders only (retailers' are covered by their distributor's). Click a product for its customers. Quantities are cases + pieces."
          actions={<AutoRefresh />}
        />
        <DayFilters base="/route-orders/products" date={date} buyer={buyer} confirmed={confirmed} by={by} extra={keep} distributorsOnly />
        <CategorySummary lines={lines} />
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs font-semibold text-muted-foreground">Columns</span>
          <span className="inline-flex rounded-lg border border-input p-0.5 text-xs font-semibold">
            <Link href={colHref(false)} className={cn("rounded-md px-2 py-1", !byCategory ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>By route</Link>
            <Link href={colHref(true)} className={cn("rounded-md px-2 py-1", byCategory ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>By category</Link>
          </span>
          {pendingOrders && !confirmed ? <span className="text-[12px] text-muted-foreground">{pendingOrders} order{pendingOrders === 1 ? " is" : "s are"} not confirmed yet - included, shown under Pending.</span> : null}
        </div>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-muted text-xs text-muted-foreground">
              <tr>
                <th className="sticky left-0 z-10 min-w-64 bg-muted px-3 py-2 text-left font-semibold">Product</th>
                <th className="px-3 py-2 text-left font-semibold">Pack qty</th>
                <th className="px-3 py-2 text-left font-semibold">Unit</th>
                <th className="px-3 py-2 text-right font-semibold">Total</th>
                <th className="px-3 py-2 text-right font-semibold">Confirmed</th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Pending</th>
                <th className="px-3 py-2 text-right font-semibold">Value</th>
                {heads.map((h) => <th key={h} className="whitespace-nowrap border-l border-border px-3 py-2 text-right font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <Fragment key={c}>
                  <tr className="border-t border-border bg-muted/40"><td colSpan={span} className="sticky left-0 px-3 py-1.5 text-xs font-semibold">{c}</td></tr>
                  {table.filter((r) => r.category === c).map((r) => {
                    const pending = r.qty - r.confirmedQty;
                    return (
                      <tr key={r.label.sku + r.name} className="border-t border-border align-top hover:bg-muted/40">
                        <td className="sticky left-0 bg-background px-3 py-2">
                          <details className="group">
                            <summary className="cursor-pointer list-none"><ProductCell p={r.label} /><div className="pl-10 text-xs text-tertiary-foreground">{r.pack > 1 ? `case of ${r.pack}` : "pieces"} · <span className="text-primary group-open:hidden">{r.customers.size} {r.customers.size === 1 ? "customer" : "customers"} ›</span><span className="hidden text-primary group-open:inline">hide</span></div></summary>
                            <ul className="mt-1.5 space-y-0.5 pl-10 text-[12px]">
                              {[...r.customers.values()].sort((a, b) => b.qty - a.qty).map((x) => (
                                <li key={x.name + x.route} className="flex justify-between gap-3">
                                  <span className={x.pending ? "text-muted-foreground" : ""}>{x.name} <span className="text-muted-foreground">· {x.route}</span></span>
                                  <span className="num font-medium">{cases(x.qty, r.pack)}</span>
                                </li>
                              ))}
                            </ul>
                          </details>
                        </td>
                        <td className="num whitespace-nowrap px-3 py-2">{r.label.qty ?? "—"}</td>
                        <td className="whitespace-nowrap px-3 py-2">{r.label.unit ?? "—"}</td>
                        <td className="num whitespace-nowrap px-3 py-2 text-right font-semibold">{cases(r.qty, r.pack)}<div className="text-[11px] font-normal text-muted-foreground">{kg(r.kg)}</div></td>
                        <td className="num whitespace-nowrap px-3 py-2 text-right">{r.confirmedQty ? cases(r.confirmedQty, r.pack) : "—"}</td>
                        <td className="num whitespace-nowrap px-3 py-2 text-right text-muted-foreground">{pending ? cases(pending, r.pack) : "—"}</td>
                        <td className="num whitespace-nowrap px-3 py-2 text-right">{inr(r.value)}</td>
                        {heads.map((h) => <td key={h} className="num whitespace-nowrap border-l border-border px-3 py-2 text-right">{r.byCol.get(h) ? cases(r.byCol.get(h)!, r.pack) : ""}</td>)}
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
              {table.length === 0 ? <tr><td colSpan={span} className="px-3 py-10 text-center text-muted-foreground">No orders for this date and filter.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
