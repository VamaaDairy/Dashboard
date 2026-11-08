import Link from "next/link";
import { ProductThumb } from "@/components/products/Product";
import { Grid3x3, ListChecks, Package, Tags, Users, X } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/cn/ui";
import { PricingTabs } from "@/components/pricing/PricingTabs";
import { packCosts, packFor } from "@/lib/pricing";
import { allListPrices, channelRates, channels, customerCheck, priceLists, standardPrices } from "@/lib/price-list";
import { cn } from "@/lib/utils";
import { CustomerCheckPicker } from "../editors";

export const dynamic = "force-dynamic";

const money = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;
const SOURCE: Record<string, string> = { list: "own list", channel: "channel price", product: "base DP" };

/**
 * Every price on one screen, to keep an eye on them: products down the left, every channel (Distributor,
 * Retailer, Super Stockist, MFS ...) and every party price list across the top. Pick a customer to add a
 * column with exactly what the Gaia app charges them, and why.
 */
export default async function PriceOverviewPage({ searchParams }: { searchParams: Promise<{ customer?: string; group?: string; q?: string }> }) {
  const { customer, group, q } = await searchParams;
  const [products, chans, rates, lists, listPrices, check, costs] = await Promise.all([
    standardPrices(),
    channels(),
    channelRates(),
    priceLists(),
    allListPrices(),
    customer ? customerCheck(customer) : Promise.resolve(null),
    packCosts(),
  ]);
  const listCustomers = lists.reduce((a, l) => a + l.customers, 0);
  const withPack = products.filter((p) => packFor(costs, p.sku)?.perPc != null).length;

  const groups = [...new Set(lists.map((l) => l.grp ?? "Other"))];
  const shownLists = group === "none" ? [] : lists.filter((l) => !group || (l.grp ?? "Other") === group);
  const byGroup = new Map<string, typeof shownLists>();
  for (const l of shownLists) byGroup.set(l.grp ?? "Other", [...(byGroup.get(l.grp ?? "Other") ?? []), l]);
  const rows = q?.trim() ? products.filter((p) => `${p.sku} ${p.name} ${p.category}`.toLowerCase().includes(q.trim().toLowerCase())) : products;
  const link = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const next = { customer, group, q, ...patch };
    for (const [k, v] of Object.entries(next)) if (v) p.set(k, v);
    return p.size ? `/price-list/overview?${p}` : "/price-list/overview";
  };
  const head = "sticky top-0 z-10 bg-muted px-3 py-2 text-right text-[11px] font-semibold whitespace-nowrap text-muted-foreground";
  const stickyLeft = "sticky left-0 z-[5] bg-card";

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-4">
        <PageHeader
          icon={Grid3x3}
          title="Price overview"
          subtitle="All prices on one screen: every SKU against its packaging cost, every channel and every party price list. Read only - change prices on SKU prices or a party list."
        />
        <PricingTabs on="overview" />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={Tags} label="SKUs" value={String(products.length)} note={`${products.filter((p) => p.inApp).length} in the apps`} href="/price-list" />
          <StatCard icon={Package} label="With packaging cost" value={String(withPack)} tone={withPack < products.length ? "warning" : "success"} note={`${products.length - withPack} without a packing list`} href="/price-list?show=nopack" />
          <StatCard icon={ListChecks} label="Party price lists" value={String(lists.length)} tone="brand" note={`${chans.length} channels`} href="/price-list/lists" />
          <StatCard icon={Users} label="Customers on a list" value={String(listCustomers)} href="/price-list/customers" />
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 lg:flex-row lg:items-center">
          <CustomerCheckPicker current={check?.uid} />
          <form action="/price-list/overview" className="lg:w-72">
            {customer ? <input type="hidden" name="customer" value={customer} /> : null}
            {group ? <input type="hidden" name="group" value={group} /> : null}
            <input name="q" defaultValue={q} placeholder="Filter products" className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-foreground" />
          </form>
          <div className="flex flex-wrap gap-1.5 text-[13px] lg:ml-auto">
            {[["", "All lists"], ...groups.map((g) => [g, g]), ["none", "Channels only"]].map(([v, l]) => (
              <Link key={v} href={link({ group: v || undefined })} className={cn("rounded-full border px-2.5 py-1", (group ?? "") === v ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted")}>
                {l}
              </Link>
            ))}
          </div>
        </div>

        {check ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-[13px]">
            <div>
              <span className="font-semibold">{check.name}</span> <span className="font-mono text-tertiary-foreground">{check.code}</span>
              <span className="text-tertiary-foreground"> · {[check.channel, check.city].filter(Boolean).join(", ")}</span>
              <span className="text-tertiary-foreground"> · price list: </span><span className="font-medium">{check.list ?? "none (channel prices)"}</span>
            </div>
            <span className="flex items-center gap-3">
              <Link href={`/price-list/customers/${check.uid}`} className="text-primary hover:underline">Full price sheet</Link>
              <Link href={link({ customer: undefined })} className="inline-flex items-center gap-1 text-tertiary-foreground hover:text-foreground"><X className="size-3.5" /> Close</Link>
            </span>
          </div>
        ) : null}

        <div className="max-h-[75vh] overflow-auto rounded-lg border border-border">
          <table className="w-full border-separate border-spacing-0 text-[13px]">
            <thead>
              {/* group headings */}
              <tr>
                <th rowSpan={2} className={cn(head, "left-0 z-20 min-w-60 border-r border-border text-left")}>Product</th>
                {check ? <th rowSpan={2} className={cn(head, "border-r border-border text-foreground")}>{check.name.length > 18 ? `${check.name.slice(0, 18)}…` : check.name}<div className="font-normal">pays in app</div></th> : null}
                <th rowSpan={2} className={cn(head, "border-r border-border")}>Packaging<div className="font-normal">per pc</div></th>
                <th colSpan={1 + chans.length} className={cn(head, "border-r border-b border-border text-center")}>MRP & channels</th>
                {[...byGroup].map(([g, ls]) => (
                  <th key={g} colSpan={ls.length} className={cn(head, "border-r border-b border-border text-center")}>{g}</th>
                ))}
              </tr>
              <tr>
                <th className={cn(head, "top-[33px]")}>MRP</th>
                {chans.map((c, i) => (
                  <th key={c.uid} className={cn(head, "top-[33px]", i === chans.length - 1 && "border-r border-border")}>{c.name}</th>
                ))}
                {[...byGroup].flatMap(([, ls]) =>
                  ls.map((l, i) => (
                    <th key={l.uid} className={cn(head, "top-[33px] max-w-32", i === ls.length - 1 && "border-r border-border")}>
                      <Link href={`/price-list?list=${l.uid}`} title={`${l.name} - ${l.customers} customer${l.customers === 1 ? "" : "s"}`} className="block truncate hover:text-foreground hover:underline">{l.name}</Link>
                    </th>
                  )),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((p, i) => {
                const pr = rates.get(p.uid);
                const lp = listPrices.get(p.uid);
                const mine = check?.prices.get(p.sku);
                return (
                  <tr key={p.uid} className="hover:bg-muted/40">
                    <td className={cn(stickyLeft, "min-w-60 border-t border-r border-border px-3 py-2")}>
                      {i === 0 || rows[i - 1].category !== p.category ? <div className="pb-0.5 text-[10px] font-semibold tracking-wide text-tertiary-foreground uppercase">{p.category}</div> : null}
                      <div className="flex items-center gap-2"><ProductThumb image={p.image} size={32} /><div className="min-w-0">
                      <Link href={`/price-list/sku/${p.uid}`} className="font-medium hover:underline">{p.name}</Link>
                      <div className="text-[11px] text-tertiary-foreground"><span className="font-mono">{p.sku}</span>
                        <span className="ml-1.5 rounded bg-muted px-1.5 text-muted-foreground" title="Pack quantity">{p.packQty ?? "—"}</span>
                        <span className="ml-1 rounded bg-muted px-1.5 text-muted-foreground" title="Unit">{p.unit ?? "—"}</span>{!p.inApp ? <span className="ml-1.5">· not in app</span> : !p.inShop ? <span className="ml-1.5">· trade only</span> : null}</div></div></div>
                    </td>
                    {check ? (
                      <td className="num border-t border-r border-border px-3 py-2 text-right whitespace-nowrap">
                        {mine && p.inApp ? (
                          <>
                            <div className="font-semibold">{money(mine.price)}</div>
                            <div className="text-[11px] text-tertiary-foreground">{SOURCE[mine.source]}</div>
                          </>
                        ) : (
                          <span className="text-[11px] text-tertiary-foreground">{p.inApp ? "no price - hidden" : "not in app"}</span>
                        )}
                      </td>
                    ) : null}
                    <td className="num border-t border-r border-border px-3 py-2 text-right whitespace-nowrap text-muted-foreground">
                      {(() => { const pk = packFor(costs, p.sku)?.perPc; return pk == null ? <span className="text-tertiary-foreground">-</span> : <span title={p.mrp ? `${Math.round((pk / p.mrp) * 1000) / 10}% of MRP` : undefined}>{money(Math.round(pk * 100) / 100)}</span>; })()}
                    </td>
                    <td className="num border-t border-border px-3 py-2 text-right font-semibold whitespace-nowrap">{money(p.mrp)}</td>
                    {chans.map((c, j) => {
                      const v = pr?.get(c.uid);
                      return (
                        <td key={c.uid} className={cn("num border-t border-border px-3 py-2 text-right whitespace-nowrap", j === chans.length - 1 && "border-r")}>
                          {v ? <span title={`${Math.round(((p.mrp - v) / p.mrp) * 1000) / 10}% below MRP`}>{money(v)}</span> : <span className="text-tertiary-foreground">-</span>}
                        </td>
                      );
                    })}
                    {[...byGroup].flatMap(([, ls]) =>
                      ls.map((l, j) => {
                        const v = lp?.get(l.uid);
                        const db = p.db ?? null;
                        return (
                          <td
                            key={l.uid}
                            className={cn(
                              "num border-t border-border px-3 py-2 text-right whitespace-nowrap",
                              j === ls.length - 1 && "border-r",
                              v && db && v < db && "bg-emerald-500/[0.07] text-emerald-800",
                              v && db && v > db && "bg-amber-500/[0.08] text-amber-800",
                            )}
                            title={v && db ? `${v < db ? "Below" : v > db ? "Above" : "Same as"} the distributor price ${money(db)}` : undefined}
                          >
                            {v ? money(v) : <span className="text-tertiary-foreground">-</span>}
                          </td>
                        );
                      }),
                    )}
                  </tr>
                );
              })}
              {rows.length === 0 ? (
                <tr><td colSpan={99} className="px-4 py-10 text-center text-muted-foreground">No products match.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="text-[12px] text-tertiary-foreground">
          &quot;-&quot; means the list does not price that product, so its customers pay their channel price. List prices in <span className="text-emerald-700">green</span> are below the distributor price, <span className="text-amber-700">amber</span> above it. Click a SKU for its price card.
        </p>
      </div>
    </div>
  );
}
