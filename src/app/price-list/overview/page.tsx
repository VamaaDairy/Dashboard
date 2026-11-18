import Link from "next/link";
import { ProductThumb } from "@/components/products/Product";
import { X } from "lucide-react";
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
  const [products, chans, rates, lists, listPrices, check] = await Promise.all([
    standardPrices(),
    channels(),
    channelRates(),
    priceLists(),
    allListPrices(),
    customer ? customerCheck(customer) : Promise.resolve(null),
  ]);

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
  const head = "sticky top-0 z-10 bg-card px-3 py-2 text-right text-[12px] font-medium whitespace-nowrap text-foreground/75";
  const stickyLeft = "sticky left-0 z-[5] bg-card";

  return (
    <div className="pt-4">
      <div className="w-full space-y-4">
        <div className="flex flex-col gap-3 rounded-xl border border-foreground/10 bg-card p-3 lg:flex-row lg:items-center">
          <CustomerCheckPicker current={check?.uid} />
          <form action="/price-list/overview" className="lg:w-72">
            {customer ? <input type="hidden" name="customer" value={customer} /> : null}
            {group ? <input type="hidden" name="group" value={group} /> : null}
            <input name="q" defaultValue={q} placeholder="Filter products" className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-foreground" />
          </form>
          <div className="flex flex-wrap gap-1.5 text-[13px] lg:ml-auto">
            {[["", "All lists"], ...groups.map((g) => [g, g]), ["none", "Channels only"]].map(([v, l]) => (
              <Link key={v} href={link({ group: v || undefined })} className={cn("rounded-lg border px-2.5 py-1", (group ?? "") === v ? "border-foreground bg-foreground text-background" : "border-foreground/15 text-foreground hover:bg-foreground/[0.04]")}>
                {l}
              </Link>
            ))}
          </div>
        </div>

        {check ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-foreground/10 bg-card px-4 py-3 text-[13px]">
            <div>
              <Link href={`/price-list/customers?c=${check.uid}`} className="font-semibold hover:underline">{check.name}</Link> <span className="font-mono text-foreground/75">{check.code}</span>
              <span className="text-foreground/75"> · {[check.channel, check.city].filter(Boolean).join(", ")}</span>
              <span className="text-foreground/75"> · price list: </span><span className="font-medium">{check.list ?? "none (channel prices)"}</span>
            </div>
            <Link href={link({ customer: undefined })} className="inline-flex items-center gap-1 text-foreground/75 hover:text-foreground"><X className="size-3.5" /> Close</Link>
          </div>
        ) : null}

        <div className="max-h-[calc(100vh-17rem)] overflow-auto rounded-xl bg-card border border-foreground/10">
          <table className="w-full border-separate border-spacing-0 text-[13px]">
            <thead>
              {/* group headings */}
              <tr>
                <th rowSpan={2} className={cn(head, "left-0 z-20 min-w-60 border-r border-foreground/10 text-left")}>Product</th>
                {check ? <th rowSpan={2} className={cn(head, "border-r border-foreground/10 text-foreground")}>{check.name.length > 18 ? `${check.name.slice(0, 18)}…` : check.name}<div className="font-normal">pays in app</div></th> : null}
                <th colSpan={1 + chans.length} className={cn(head, "border-r border-b border-foreground/10 text-center")}>MRP & channels</th>
                {[...byGroup].map(([g, ls]) => (
                  <th key={g} colSpan={ls.length} className={cn(head, "border-r border-b border-foreground/10 text-center")}>{g}</th>
                ))}
              </tr>
              <tr>
                <th className={cn(head, "top-[33px]")}>MRP</th>
                {chans.map((c, i) => (
                  <th key={c.uid} className={cn(head, "top-[33px]", i === chans.length - 1 && "border-r border-foreground/10")}>{c.name}</th>
                ))}
                {[...byGroup].flatMap(([, ls]) =>
                  ls.map((l, i) => (
                    <th key={l.uid} className={cn(head, "top-[33px] max-w-32", i === ls.length - 1 && "border-r border-foreground/10")}>
                      <Link href={`/price-list/lists?list=${l.uid}`} title={`${l.name} - ${l.customers} customer${l.customers === 1 ? "" : "s"}`} className="block truncate hover:text-foreground hover:underline">{l.name}</Link>
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
                    <td className={cn(stickyLeft, "min-w-60 border-t border-r border-foreground/10 px-3 py-2")}>
                      {i === 0 || rows[i - 1].category !== p.category ? <div className="pb-0.5 text-[10px] font-semibold tracking-wide text-foreground/75 uppercase">{p.category}</div> : null}
                      <div className="flex items-center gap-2"><ProductThumb image={p.image} size={30} /><div className="min-w-0">
                      <Link href={`/price-list?sku=${p.uid}`} className="font-medium hover:underline">{p.name}</Link>
                      <div className="tabular-nums text-[12px] text-foreground/75">{[p.sku, [p.packQty, p.unit].filter(Boolean).join(" ")].filter(Boolean).join(" · ")}{!p.inApp ? " · not on sale" : ""}</div></div></div>
                    </td>
                    {check ? (
                      <td className="tabular-nums border-t border-r border-foreground/10 px-3 py-2 text-right whitespace-nowrap">
                        {mine && p.inApp ? (
                          <>
                            <div className="font-semibold">{money(mine.price)}</div>
                            <div className="text-[11px] text-foreground/75">{SOURCE[mine.source]}</div>
                          </>
                        ) : (
                          <span className="text-[11px] text-foreground/75">{p.inApp ? "no price - hidden" : "not in app"}</span>
                        )}
                      </td>
                    ) : null}
                    <td className="tabular-nums border-t border-foreground/10 px-3 py-2 text-right font-semibold whitespace-nowrap">{money(p.mrp)}</td>
                    {chans.map((c, j) => {
                      const v = pr?.get(c.uid);
                      return (
                        <td key={c.uid} className={cn("tabular-nums border-t border-foreground/10 px-3 py-2 text-right whitespace-nowrap", j === chans.length - 1 && "border-r")}>
                          {v ? <span title={`${Math.round(((p.mrp - v) / p.mrp) * 1000) / 10}% below MRP`}>{money(v)}</span> : <span className="text-foreground/75">-</span>}
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
                              "tabular-nums border-t border-foreground/10 px-3 py-2 text-right whitespace-nowrap",
                              j === ls.length - 1 && "border-r",
                            )}
                            title={v && db ? `${v < db ? "Below" : v > db ? "Above" : "Same as"} the distributor price ${money(db)}` : undefined}
                          >
                            {v ? money(v) : <span className="text-foreground/75">-</span>}
                          </td>
                        );
                      }),
                    )}
                  </tr>
                );
              })}
              {rows.length === 0 ? (
                <tr><td colSpan={99} className="px-4 py-10 text-center text-foreground/75">No products match.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="text-[12px] text-foreground/75">
          &quot;-&quot; means the list does not price that product, so its customers pay their channel price.
        </p>
      </div>
    </div>
  );
}
