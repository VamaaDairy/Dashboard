import Link from "next/link";
import { cookies } from "next/headers";
import { Search, Tags } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, Pill } from "@/components/cn/ui";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { listCustomers, listPrices, priceList, priceLists, standardPrices, type PriceList } from "@/lib/price-list";
import { cn } from "@/lib/utils";
import { CustomerPicker, ListSettings, NewList, PriceCell, RemoveCustomer } from "./editors";

export const dynamic = "force-dynamic";

const pct = (price: number | null, mrp: number) => (price && mrp ? `${Math.round(((mrp - price) / mrp) * 1000) / 10}%` : "");

/**
 * Price list: what every customer pays. Standard prices (MRP, Retailer, Distributor) apply to everyone;
 * a party price list overrides them for the customers on it. The Gaia app shows each customer its own price.
 */
export default async function PriceListPage({ searchParams }: { searchParams: Promise<{ list?: string; q?: string }> }) {
  const { list: listUid, q } = await searchParams;
  const me = await userFromToken((await cookies()).get("session")?.value);
  const canEdit = !!me && atLeast(levelFor(me, "pricelist"), "edit");

  const [products, lists, list] = await Promise.all([standardPrices(), priceLists(), listUid ? priceList(listUid) : Promise.resolve(null)]);
  const [prices, customers] = list ? await Promise.all([listPrices(list.uid), listCustomers(list.uid)]) : [null, []];
  const shown = q?.trim() ? products.filter((p) => `${p.sku} ${p.name} ${p.category}`.toLowerCase().includes(q.trim().toLowerCase())) : products;

  const groups = new Map<string, PriceList[]>();
  for (const l of lists) groups.set(l.grp ?? "Other", [...(groups.get(l.grp ?? "Other") ?? []), l]);
  const here = (uid?: string, extra?: string) => {
    const p = new URLSearchParams();
    if (uid) p.set("list", uid);
    if (extra) p.set("q", extra);
    return p.size ? `/price-list?${p}` : "/price-list";
  };

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-4">
        <PageHeader
          icon={Tags}
          title="Price list"
          subtitle="What each customer pays. A party's own list comes first, then the Retailer or Distributor price - the Gaia app shows every customer their own price."
        />

        <div className="grid items-start gap-5 lg:grid-cols-[17rem_minmax(0,1fr)]">
          {/* the lists */}
          <aside className="space-y-3 lg:sticky lg:top-4">
            <Link
              href={here(undefined, q)}
              className={cn("block rounded-lg border px-3 py-2.5 text-sm", !list ? "border-primary bg-primary/5 font-semibold" : "border-border hover:bg-muted")}
            >
              Standard prices
              <div className="text-[12px] font-normal text-tertiary-foreground">MRP, Retailer, Distributor</div>
            </Link>
            <div className="max-h-[65vh] space-y-3 overflow-y-auto rounded-lg border border-border p-2">
              {[...groups].map(([g, ls]) => (
                <div key={g}>
                  <div className="px-2 pb-1 text-[11px] font-semibold tracking-wide text-tertiary-foreground uppercase">{g}</div>
                  {ls.map((l) => (
                    <Link
                      key={l.uid}
                      href={here(l.uid, q)}
                      className={cn("flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[13px]", list?.uid === l.uid ? "bg-primary/10 font-semibold text-foreground" : "hover:bg-muted")}
                    >
                      <span className="truncate">{l.name}</span>
                      <span className="shrink-0 text-[11px] text-tertiary-foreground">{l.customers}</span>
                    </Link>
                  ))}
                </div>
              ))}
              {lists.length === 0 ? <p className="px-2 py-3 text-[13px] text-tertiary-foreground">No party price lists yet.</p> : null}
            </div>
            {canEdit ? <NewList groups={[...groups.keys()].filter((g) => g !== "Other")} /> : null}
          </aside>

          {/* the prices */}
          <div className="min-w-0 space-y-4">
            {list ? (
              <div className="flex flex-col gap-3 rounded-lg border border-border p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold">{list.name}</h2>
                    {list.grp ? <Pill dot={false}>{list.grp}</Pill> : null}
                  </div>
                  <p className="text-[13px] text-tertiary-foreground">
                    {customers.length} customer{customers.length === 1 ? "" : "s"} pay these prices. Leave a price empty to take the product off the list; they then pay their channel price (grey).
                  </p>
                </div>
                {canEdit ? <ListSettings uid={list.uid} name={list.name} grp={list.grp} /> : null}
              </div>
            ) : null}

            <form action="/price-list" className="relative max-w-sm">
              {list ? <input type="hidden" name="list" value={list.uid} /> : null}
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <input name="q" defaultValue={q} placeholder="Search product, SKU or category" className="h-9 w-full rounded-lg border border-input bg-background pr-3 pl-8 text-sm outline-none focus:border-primary" />
            </form>

            <div className={cn("grid items-start gap-5", list && "xl:grid-cols-[minmax(0,1fr)_20rem]")}>
              <Panel flush>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2 font-semibold">Product</th>
                        <th className="px-2 py-2 text-right font-semibold">MRP</th>
                        {list ? (
                          <>
                            <th className="px-2 py-2 text-right font-semibold">Distributor</th>
                            <th className="px-2 py-2 text-right font-semibold text-foreground">{list.name}</th>
                            <th className="px-4 py-2 text-right font-semibold">Margin</th>
                          </>
                        ) : (
                          <>
                            <th className="px-2 py-2 text-right font-semibold">Retailer</th>
                            <th className="px-2 py-2 text-right font-semibold">Distributor</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((p, i) => (
                        <tr key={p.uid} className="border-t border-border hover:bg-muted/30">
                          <td className="min-w-64 px-4 py-1.5">
                            {i === 0 || shown[i - 1].category !== p.category ? <div className="pt-2 pb-1 text-[11px] font-semibold tracking-wide text-tertiary-foreground uppercase">{p.category}</div> : null}
                            <div className="font-medium">{p.name}</div>
                            <div className="font-mono text-[11px] text-tertiary-foreground">{p.sku}</div>
                          </td>
                          <td className="px-2 py-1.5 text-right align-bottom">
                            <PriceCell target={{ kind: "mrp" }} productUid={p.uid} value={p.mrp} canEdit={canEdit && !list} />
                          </td>
                          {list ? (
                            <>
                              <td className="num px-2 py-1.5 text-right align-bottom text-muted-foreground">{p.db ? `₹${p.db}` : "-"}</td>
                              <td className="px-2 py-1.5 text-right align-bottom">
                                <PriceCell target={{ kind: "list", list: list.uid }} productUid={p.uid} value={prices?.get(p.uid) ?? null} fallback={p.db} canEdit={canEdit} clearable />
                              </td>
                              <td className="num px-4 py-1.5 text-right align-bottom text-[12px] text-emerald-700">{pct(prices?.get(p.uid) ?? null, p.mrp)}</td>
                            </>
                          ) : (
                            <>
                              <td className="px-2 py-1.5 text-right align-bottom">
                                <PriceCell target={{ kind: "channel", channel: "RT" }} productUid={p.uid} value={p.rt} canEdit={canEdit} />
                                <div className="pr-2 text-[11px] text-emerald-700">{pct(p.rt, p.mrp)}</div>
                              </td>
                              <td className="px-2 py-1.5 text-right align-bottom">
                                <PriceCell target={{ kind: "channel", channel: "DB" }} productUid={p.uid} value={p.db} canEdit={canEdit} />
                                <div className="pr-2 text-[11px] text-emerald-700">{pct(p.db, p.mrp)}</div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                      {shown.length === 0 ? (
                        <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No products match.</td></tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </Panel>

              {list ? (
                <Panel title="Customers on this list" description="Each customer is on one list at a time.">
                  <div className="space-y-3">
                    {canEdit ? <CustomerPicker listUid={list.uid} /> : null}
                    <ul className="divide-y divide-border text-[13px]">
                      {customers.map((c) => (
                        <li key={c.uid} className="flex items-center justify-between gap-2 py-2">
                          <div className="min-w-0">
                            <div className="truncate font-medium">{c.name}</div>
                            <div className="truncate text-[11px] text-tertiary-foreground">
                              <span className="font-mono">{c.code}</span> · {[c.channel, c.city].filter(Boolean).join(", ")}{c.active ? "" : " · inactive"}
                            </div>
                          </div>
                          {canEdit ? <RemoveCustomer listUid={list.uid} firmUid={c.uid} name={c.name} /> : null}
                        </li>
                      ))}
                      {customers.length === 0 ? <li className="py-3 text-tertiary-foreground">No customers yet.</li> : null}
                    </ul>
                  </div>
                </Panel>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
