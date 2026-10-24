import Link from "next/link";
import { cookies } from "next/headers";
import { Grid3x3, Search, Tags } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Panel } from "@/components/cn/ui";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { listCustomers, listPrices, priceList, priceLists, standardPrices } from "@/lib/price-list";
import { cn } from "@/lib/utils";
import { CustomerPicker, ListPicker, ListSettings, NewList, PriceCell, RemoveCustomer } from "./editors";

export const dynamic = "force-dynamic";

const pct = (price: number | null, mrp: number) => (price && mrp ? `${Math.round(((mrp - price) / mrp) * 1000) / 10}% margin` : "");

/**
 * Price list: what every customer pays, one list at a time. Standard prices (MRP, Retailer, Distributor) apply to
 * everyone; a party price list overrides them for the customers on it. The Gaia app shows each customer its own price.
 */
export default async function PriceListPage({ searchParams }: { searchParams: Promise<{ list?: string; q?: string }> }) {
  const { list: listUid, q } = await searchParams;
  const me = await userFromToken((await cookies()).get("session")?.value);
  const canEdit = !!me && atLeast(levelFor(me, "pricelist"), "edit");

  const [products, lists, list] = await Promise.all([standardPrices(), priceLists(), listUid ? priceList(listUid) : Promise.resolve(null)]);
  const [prices, customers] = list ? await Promise.all([listPrices(list.uid), listCustomers(list.uid)]) : [null, []];
  const shown = q?.trim() ? products.filter((p) => `${p.sku} ${p.name} ${p.category}`.toLowerCase().includes(q.trim().toLowerCase())) : products;
  const groups = [...new Set(lists.map((l) => l.grp).filter((g): g is string => !!g))];
  const cols = list ? 5 : 4;

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <PageHeader
          icon={Tags}
          title="Price list"
          subtitle="Pick a list, click a price to change it. A party's own list comes first, then the Retailer or Distributor price."
          actions={<Link href="/price-list/overview" className={buttonVariants({ variant: "outline" })}><Grid3x3 className="size-4" /> Price overview</Link>}
        />

        {/* which list, which products */}
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 md:flex-row md:items-center">
          <ListPicker lists={lists} current={list?.uid} q={q} />
          <form action="/price-list" className="relative flex-1 md:max-w-sm">
            {list ? <input type="hidden" name="list" value={list.uid} /> : null}
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <input name="q" defaultValue={q} placeholder="Search product, SKU or category" className="h-10 w-full rounded-lg border border-input bg-background pr-3 pl-8 text-sm outline-none focus:border-foreground" />
          </form>
          {canEdit ? <div className="md:ml-auto md:w-56"><NewList groups={groups} /></div> : null}
        </div>

        {list ? (
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">{list.name}</h2>
                {list.grp ? <span className="text-[13px] text-tertiary-foreground">· {list.grp}</span> : null}
              </div>
              <p className="text-[13px] text-tertiary-foreground">
                {customers.length} customer{customers.length === 1 ? "" : "s"} pay these prices. Empty price = the product is not on this list; they pay their channel price (grey).
              </p>
            </div>
            {canEdit ? <ListSettings uid={list.uid} name={list.name} grp={list.grp} /> : null}
          </div>
        ) : null}

        <div className={cn("grid items-start gap-5", list && "xl:grid-cols-[minmax(0,1fr)_21rem]")}>
          <Panel flush>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Product</th>
                    <th className="px-2 py-2.5 text-right font-semibold">MRP</th>
                    {list ? (
                      <>
                        <th className="px-2 py-2.5 text-right font-semibold">Distributor</th>
                        <th className="px-2 py-2.5 text-right font-semibold text-foreground">This list</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Margin</th>
                      </>
                    ) : (
                      <>
                        <th className="px-2 py-2.5 text-right font-semibold">Retailer</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Distributor</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((p, i) => (
                    <FragmentRow key={p.uid} category={i === 0 || shown[i - 1].category !== p.category ? p.category : null} cols={cols}>
                      <tr className="border-t border-border hover:bg-muted/30">
                        <td className="min-w-64 px-4 py-2">
                          <div className="font-medium text-foreground">{p.name}</div>
                          <div className="text-[11px] text-tertiary-foreground">
                            <span className="font-mono">{p.sku}</span>
                            {p.inApp ? null : <span className="ml-2">· not shown in the app</span>}
                          </div>
                        </td>
                        <td className="px-2 py-2 text-right">
                          <PriceCell target={{ kind: "mrp" }} productUid={p.uid} value={p.mrp} canEdit={canEdit && !list} />
                        </td>
                        {list ? (
                          <>
                            <td className="num px-2 py-2 text-right text-muted-foreground">{p.db ? `₹${p.db}` : "-"}</td>
                            <td className="px-2 py-2 text-right">
                              <PriceCell target={{ kind: "list", list: list.uid }} productUid={p.uid} value={prices?.get(p.uid) ?? null} fallback={p.db} canEdit={canEdit} clearable />
                            </td>
                            <td className="num px-4 py-2 text-right text-[12px] text-tertiary-foreground">{pct(prices?.get(p.uid) ?? null, p.mrp)}</td>
                          </>
                        ) : (
                          <>
                            <td className="px-2 py-2 text-right">
                              <PriceCell target={{ kind: "channel", channel: "RT" }} productUid={p.uid} value={p.rt} canEdit={canEdit} />
                              <div className="pr-2 text-[11px] text-tertiary-foreground">{pct(p.rt, p.mrp)}</div>
                            </td>
                            <td className="px-4 py-2 text-right">
                              <PriceCell target={{ kind: "channel", channel: "DB" }} productUid={p.uid} value={p.db} canEdit={canEdit} />
                              <div className="pr-2 text-[11px] text-tertiary-foreground">{pct(p.db, p.mrp)}</div>
                            </td>
                          </>
                        )}
                      </tr>
                    </FragmentRow>
                  ))}
                  {shown.length === 0 ? (
                    <tr><td colSpan={cols} className="px-4 py-10 text-center text-muted-foreground">No products match.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Panel>

          {list ? (
            <Panel title={`Customers (${customers.length})`} description="Each customer is on one list at a time." className="xl:sticky xl:top-4">
              <div className="space-y-3">
                {canEdit ? <CustomerPicker listUid={list.uid} /> : null}
                <ul className="max-h-[60vh] divide-y divide-border overflow-y-auto text-[13px]">
                  {customers.map((c) => (
                    <li key={c.uid} className="flex items-center justify-between gap-2 py-2">
                      <div className="min-w-0">
                        <Link href={`/price-list/overview?customer=${c.uid}`} className="block truncate font-medium hover:underline">{c.name}</Link>
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
  );
}

/** A product row, with its category as a heading row above the first product of each category. */
function FragmentRow({ category, cols, children }: { category: string | null; cols: number; children: React.ReactNode }) {
  return (
    <>
      {category ? (
        <tr className="border-t border-border bg-muted/30">
          <td colSpan={cols} className="px-4 py-1.5 text-[11px] font-semibold tracking-wide text-tertiary-foreground uppercase">{category}</td>
        </tr>
      ) : null}
      {children}
    </>
  );
}
