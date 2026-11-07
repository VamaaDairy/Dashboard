import { Fragment } from "react";
import Link from "next/link";
import { Route } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Pill } from "@/components/cn/ui";
import { Stat } from "@/app/app-orders/parts";
import { dayLines, filterLines, listRoutes, validDate, type DayLine } from "@/lib/route-orders/data";
import { Chip, DayFilters, Notice, cases, inr, kg } from "./parts";
import { labelOf, productLabels, type ProductLabel } from "@/lib/products/names";
import { ProductThumb } from "@/components/products/Product";

export const dynamic = "force-dynamic";

interface Column { sku: string; label: ProductLabel; name: string; category: string; pack: number; sort: number }

const skuKey = (l: DayLine) => (l.product ? `p${l.product.sku_no}` : `s${l.sku}`);

export default async function RouteSheetPage({ searchParams }: { searchParams: Promise<{ date?: string; buyer?: string; route?: string; confirmed?: string }> }) {
  const sp = await searchParams;
  const date = validDate(sp.date);
  const buyer = sp.buyer || "all";
  const confirmed = sp.confirmed === "1";
  const route = sp.route || "all";
  const [all, routes, labels] = await Promise.all([dayLines(date), listRoutes(), productLabels()]);
  const forBuyer = filterLines(all, { buyer, confirmed });
  const lines = filterLines(forBuyer, { route });

  const parties = (ls: DayLine[]) => new Set(ls.map((l) => l.party?.id ?? l.firmUid)).size;
  const routeHref = (r: string) => {
    const p = new URLSearchParams({ date });
    if (buyer !== "all") p.set("buyer", buyer);
    if (confirmed) p.set("confirmed", "1");
    if (r !== "all") p.set("route", r);
    return `/route-orders?${p}`;
  };

  const columns = new Map<string, Column>();
  for (const l of lines) {
    columns.set(skuKey(l), {
      sku: skuKey(l),
      label: labelOf(labels, l.sku, l.product?.name ?? l.skuName),
      name: labelOf(labels, l.sku, l.product?.name ?? l.skuName).name,
      category: l.product?.category ?? "Not in master",
      pack: Number(l.product?.pack_size ?? 1),
      sort: l.product?.sort ?? 9999,
    });
  }
  const cols = [...columns.values()].sort((a, b) => a.sort - b.sort);
  const categories: Array<{ name: string; span: number }> = [];
  for (const c of cols) {
    const last = categories[categories.length - 1];
    if (last?.name === c.category) last.span++;
    else categories.push({ name: c.category, span: 1 });
  }

  const weight = (l: DayLine) => l.qty * Number(l.product?.weight_kg ?? 0);
  const rows = new Map<string, { key: string; name: string; route: string; routeSort: number; channel: string | null; pending: boolean; matched: boolean; qty: Map<string, number>; kg: number; value: number }>();
  const sortOf = new Map(routes.map((r) => [r.name, r.sort]));
  const totals = new Map<string, number>();
  for (const l of lines) {
    const key = l.party ? `p${l.party.id}` : `f${l.firmUid}`;
    let r = rows.get(key);
    if (!r) {
      const rt = l.routeName ?? "No route";
      r = { key, name: l.party?.name ?? l.firmName, route: rt, routeSort: sortOf.get(rt) ?? 999, channel: l.party?.channel ?? null, pending: false, matched: !!l.party, qty: new Map(), kg: 0, value: 0 };
      rows.set(key, r);
    }
    r.qty.set(skuKey(l), (r.qty.get(skuKey(l)) ?? 0) + l.qty);
    totals.set(skuKey(l), (totals.get(skuKey(l)) ?? 0) + l.qty);
    r.kg += weight(l);
    r.value += l.amount;
    if (l.status.toLowerCase() !== "confirmed") r.pending = true;
  }
  const table = [...rows.values()].sort((a, b) => a.routeSort - b.routeSort || a.name.localeCompare(b.name));
  const groups = [...new Set(table.map((r) => r.route))];
  const totalKg = lines.reduce((s, l) => s + weight(l), 0);
  const totalValue = lines.reduce((s, l) => s + l.amount, 0);
  const unmatched = table.filter((r) => !r.matched).length;
  const unknownSkus = new Set(lines.filter((l) => !l.product).map((l) => l.sku)).size;

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-4">
        <PageHeader icon={Route} title="Route sheet" subtitle="The day's orders from the apps and portal, route by route." />
        <DayFilters base="/route-orders" date={date} buyer={buyer} route={route === "all" ? undefined : route} confirmed={confirmed} />

        <div className="flex flex-wrap gap-1.5 border-t border-border pt-3">
          <Chip href={routeHref("all")} on={route === "all"}>All routes <span className="ml-1 opacity-70">{parties(forBuyer)}</span></Chip>
          {routes.map((r) => {
            const n = parties(filterLines(forBuyer, { route: String(r.id) }));
            return <Chip key={r.id} href={routeHref(String(r.id))} on={route === String(r.id)}>{r.name} <span className="ml-1 opacity-70">{n}</span></Chip>;
          })}
          {forBuyer.some((l) => !l.party?.route_id) ? <Chip href={routeHref("none")} on={route === "none"}>No route <span className="ml-1 opacity-70">{parties(filterLines(forBuyer, { route: "none" }))}</span></Chip> : null}
        </div>

        <div className="grid grid-cols-2 gap-4 rounded-lg border border-border p-4 md:grid-cols-4">
          <Stat label="Customers" value={table.length} />
          <Stat label="Orders" value={new Set(lines.map((l) => l.orderUid)).size} />
          <Stat label="Load" value={kg(totalKg)} />
          <Stat label="Value" value={inr(totalValue)} />
        </div>

        {unmatched || unknownSkus ? (
          <Notice tone="warn">
            {unmatched ? `${unmatched} customer${unmatched === 1 ? " isn't" : "s aren't"} matched to the customer master. ` : ""}
            {unknownSkus ? `${unknownSkus} product${unknownSkus === 1 ? " isn't" : "s aren't"} in the product master. ` : ""}
            <Link href="/route-orders/masters" className="font-medium underline">Fix them</Link> to get them on the right route and billed.
          </Notice>
        ) : null}

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-muted text-xs text-muted-foreground">
              <tr>
                <th rowSpan={2} className="sticky left-0 z-20 min-w-56 bg-muted px-3 py-2 text-left font-semibold">Customer</th>
                {categories.map((c, i) => <th key={i} colSpan={c.span} className="whitespace-nowrap border-l border-border px-2 py-1.5 text-center font-semibold">{c.name}</th>)}
                <th rowSpan={2} className="border-l border-border px-3 py-2 text-right font-semibold">Load</th>
                <th rowSpan={2} className="px-3 py-2 text-right font-semibold">Value</th>
              </tr>
              <tr>
                {cols.map((c) => (
                  <th key={c.sku} className="min-w-20 border-l border-t border-border px-2 py-1.5 text-right align-bottom font-medium">
                    <div className="flex justify-end"><ProductThumb image={c.label.image} size={28} /></div>
                    <div className="font-mono text-[10px] font-normal text-tertiary-foreground">{c.label.sku}</div>
                    {c.name.replace(/^Gaia /, "")}
                    <div className="font-normal text-muted-foreground">{[c.label.qty, c.label.unit].filter(Boolean).join(" ") || "—"}</div>
                    <div className="font-normal text-tertiary-foreground">{c.pack > 1 ? `case of ${c.pack} + pcs` : "pcs"}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <Fragment key={g}>
                  {route === "all" ? <tr className="border-t border-border bg-muted/40"><td colSpan={cols.length + 3} className="sticky left-0 px-3 py-1.5 text-xs font-semibold">{g}</td></tr> : null}
                  {table.filter((r) => r.route === g).map((r) => (
                    <tr key={r.key} className="border-t border-border hover:bg-muted/40">
                      <td className="sticky left-0 z-10 bg-background px-3 py-2">
                        <div className="font-medium">{r.name}</div>
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {r.channel ? <Pill dot={false}>{r.channel}</Pill> : null}
                          {r.pending ? <Pill tone="warning">Pending</Pill> : null}
                          {!r.matched ? <Pill tone="danger">Not matched</Pill> : null}
                        </div>
                      </td>
                      {cols.map((c) => {
                        const q = r.qty.get(c.sku);
                        return <td key={c.sku} className="num whitespace-nowrap border-l border-border px-2 py-2 text-right">{q ? cases(q, c.pack) : ""}</td>;
                      })}
                      <td className="num whitespace-nowrap border-l border-border px-3 py-2 text-right text-muted-foreground">{kg(r.kg)}</td>
                      <td className="num whitespace-nowrap px-3 py-2 text-right font-medium">{inr(r.value)}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
              {table.length === 0 ? <tr><td colSpan={cols.length + 3} className="px-3 py-10 text-center text-muted-foreground">No orders for this date and filter.</td></tr> : null}
            </tbody>
            {table.length ? (
              <tfoot className="border-t-2 border-border bg-muted/40 font-semibold">
                <tr>
                  <td className="sticky left-0 z-10 bg-muted px-3 py-2">Total</td>
                  {cols.map((c) => <td key={c.sku} className="num whitespace-nowrap border-l border-border px-2 py-2 text-right">{cases(totals.get(c.sku) ?? 0, c.pack)}</td>)}
                  <td className="num whitespace-nowrap border-l border-border px-3 py-2 text-right">{kg(totalKg)}</td>
                  <td className="num whitespace-nowrap px-3 py-2 text-right">{inr(totalValue)}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </div>
    </div>
  );
}
