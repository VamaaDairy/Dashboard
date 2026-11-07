import { Fragment } from "react";
import { Boxes } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { dayLines, filterLines, listRoutes, validDate } from "@/lib/route-orders/data";
import { DayFilters, cases, inr, kg } from "../parts";
import { labelOf, productLabels, type ProductLabel } from "@/lib/products/names";
import { ProductCell } from "@/components/products/Product";

export const dynamic = "force-dynamic";

/** What to make and load for the day: each product's quantity by route. */
export default async function ProductTotalsPage({ searchParams }: { searchParams: Promise<{ date?: string; buyer?: string; confirmed?: string }> }) {
  const sp = await searchParams;
  const date = validDate(sp.date);
  const buyer = sp.buyer || "all";
  const confirmed = sp.confirmed === "1";
  const [all, routes, labels] = await Promise.all([dayLines(date), listRoutes(), productLabels()]);
  const lines = filterLines(all, { buyer, confirmed });

  const rows = new Map<string, { label: ProductLabel; name: string; category: string; pack: number; sort: number; byRoute: Map<string, number>; qty: number; kg: number; value: number }>();
  for (const l of lines) {
    const key = l.product ? `p${l.product.sku_no}` : `s${l.sku}`;
    let r = rows.get(key);
    if (!r) {
      const label = labelOf(labels, l.sku, l.product?.name ?? l.skuName);
      r = { label, name: label.name, category: l.product?.category ?? "Not in master", pack: Number(l.product?.pack_size ?? 1), sort: l.product?.sort ?? 9999, byRoute: new Map(), qty: 0, kg: 0, value: 0 };
      rows.set(key, r);
    }
    const rt = l.routeName ?? "No route";
    r.byRoute.set(rt, (r.byRoute.get(rt) ?? 0) + l.qty);
    r.qty += l.qty;
    r.kg += l.qty * Number(l.product?.weight_kg ?? 0);
    r.value += l.amount;
  }
  const table = [...rows.values()].sort((a, b) => a.sort - b.sort);
  const used = new Set(lines.map((l) => l.routeName ?? "No route"));
  const heads = [...routes.map((r) => r.name).filter((n) => used.has(n)), ...(used.has("No route") ? ["No route"] : [])];
  const categories = [...new Set(table.map((r) => r.category))];

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-4">
        <PageHeader icon={Boxes} title="Product totals" subtitle="Each product's quantity by route, for production and loading. Quantities are cases + pieces." />
        <DayFilters base="/route-orders/products" date={date} buyer={buyer} confirmed={confirmed} />
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-muted text-xs text-muted-foreground">
              <tr>
                <th className="sticky left-0 z-10 min-w-64 bg-muted px-3 py-2 text-left font-semibold">Product</th>
                <th className="px-3 py-2 text-left font-semibold">Pack qty</th>
                <th className="px-3 py-2 text-left font-semibold">Unit</th>
                <th className="px-3 py-2 text-right font-semibold">Total</th>
                <th className="px-3 py-2 text-right font-semibold">Load</th>
                <th className="px-3 py-2 text-right font-semibold">Value</th>
                {heads.map((h) => <th key={h} className="whitespace-nowrap border-l border-border px-3 py-2 text-right font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <Fragment key={c}>
                  <tr className="border-t border-border bg-muted/40"><td colSpan={heads.length + 6} className="sticky left-0 px-3 py-1.5 text-xs font-semibold">{c}</td></tr>
                  {table.filter((r) => r.category === c).map((r) => (
                    <tr key={r.label.sku + r.name} className="border-t border-border hover:bg-muted/40">
                      <td className="sticky left-0 bg-background px-3 py-2"><ProductCell p={r.label} /><div className="pl-10 text-xs text-tertiary-foreground">{r.pack > 1 ? `case of ${r.pack}` : "pieces"}</div></td>
                      <td className="num whitespace-nowrap px-3 py-2">{r.label.qty ?? "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2">{r.label.unit ?? "—"}</td>
                      <td className="num whitespace-nowrap px-3 py-2 text-right font-semibold">{cases(r.qty, r.pack)}</td>
                      <td className="num whitespace-nowrap px-3 py-2 text-right text-muted-foreground">{kg(r.kg)}</td>
                      <td className="num whitespace-nowrap px-3 py-2 text-right">{inr(r.value)}</td>
                      {heads.map((h) => <td key={h} className="num whitespace-nowrap border-l border-border px-3 py-2 text-right">{r.byRoute.get(h) ? cases(r.byRoute.get(h)!, r.pack) : ""}</td>)}
                    </tr>
                  ))}
                </Fragment>
              ))}
              {table.length === 0 ? <tr><td colSpan={heads.length + 6} className="px-3 py-10 text-center text-muted-foreground">No orders for this date and filter.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
