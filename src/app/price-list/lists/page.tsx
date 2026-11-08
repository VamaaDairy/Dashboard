import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowLeft, ListChecks, Search, Users } from "lucide-react";
import { ProductThumb } from "@/components/products/Product";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Panel } from "@/components/cn/ui";
import { Margin, PricingTabs } from "@/components/pricing/PricingTabs";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { listCustomers, listPrices, priceList, priceLists, standardPrices } from "@/lib/price-list";
import { marginPct } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { CustomerPicker, ListPicker, ListSettings, NewList, PriceCell, RemoveCustomer } from "../editors";

export const dynamic = "force-dynamic";

/**
 * Party price lists: special prices for a set of customers (a key distributor, a modern-trade chain ...). A customer
 * on a list pays the list's price for the products it prices, and its channel price for the rest.
 * Without `?list` the page shows every list; with it, that list's prices and customers to edit.
 */
export default async function PartyListsPage({ searchParams }: { searchParams: Promise<{ list?: string; q?: string }> }) {
  const { list: listUid, q } = await searchParams;
  const me = await userFromToken((await cookies()).get("session")?.value);
  const canEdit = !!me && atLeast(levelFor(me, "pricelist"), "edit");
  const [lists, list] = await Promise.all([priceLists(), listUid ? priceList(listUid) : Promise.resolve(null)]);
  const groups = [...new Set(lists.map((l) => l.grp).filter((g): g is string => !!g))];

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <PageHeader icon={ListChecks} title="Party price lists" subtitle="Special prices for chosen customers. Products a list doesn't price fall back to the customer's channel price." />
        <PricingTabs on="lists" />
        {list ? <ListEditor list={list} lists={lists} q={q} canEdit={canEdit} /> : <ListIndex lists={lists} groups={groups} canEdit={canEdit} />}
      </div>
    </div>
  );
}

function ListIndex({ lists, groups, canEdit }: { lists: Awaited<ReturnType<typeof priceLists>>; groups: string[]; canEdit: boolean }) {
  const byGroup = new Map<string, typeof lists>();
  for (const l of lists) byGroup.set(l.grp ?? "Other", [...(byGroup.get(l.grp ?? "Other") ?? []), l]);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-tertiary-foreground">
          {lists.length} list{lists.length === 1 ? "" : "s"} · {lists.reduce((a, l) => a + l.customers, 0)} customers on a list
        </p>
        {canEdit ? <div className="w-full sm:w-72"><NewList groups={groups} /></div> : null}
      </div>
      {lists.length === 0 ? (
        <Panel><EmptyState icon={ListChecks} title="No party price lists yet">Create one to give a customer or a group of customers their own prices.</EmptyState></Panel>
      ) : null}
      {[...byGroup].map(([g, ls]) => (
        <section key={g} className="space-y-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-tertiary-foreground">{g}</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {ls.map((l) => (
              <Link key={l.uid} href={`/price-list/lists?list=${l.uid}`} className="group rounded-lg border border-border bg-card p-4 shadow-xs transition-colors hover:border-foreground/30 hover:bg-accent/40">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-foreground group-hover:underline">{l.name}</span>
                  <ListChecks className="size-4 text-tertiary-foreground" />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
                  <div className="rounded-md bg-muted/60 px-2.5 py-1.5"><div className="num text-base font-semibold text-foreground">{l.priced}</div><div className="text-tertiary-foreground">SKUs priced</div></div>
                  <div className="rounded-md bg-muted/60 px-2.5 py-1.5"><div className="num text-base font-semibold text-foreground">{l.customers}</div><div className="text-tertiary-foreground">customers</div></div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

async function ListEditor({ list, lists, q, canEdit }: {
  list: NonNullable<Awaited<ReturnType<typeof priceList>>>; lists: Awaited<ReturnType<typeof priceLists>>; q?: string; canEdit: boolean;
}) {
  const [products, prices, customers] = await Promise.all([standardPrices(), listPrices(list.uid), listCustomers(list.uid)]);
  const shown = (q?.trim() ? products.filter((p) => `${p.sku} ${p.name} ${p.category}`.toLowerCase().includes(q.trim().toLowerCase())) : products).filter((p) => p.inApp);
  const priced = shown.filter((p) => prices.has(p.uid)).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 md:flex-row md:items-center">
        <Link href="/price-list/lists" className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> All lists</Link>
        <ListPicker lists={lists} current={list.uid} q={q} />
        <form action="/price-list/lists" className="relative flex-1 md:max-w-sm">
          <input type="hidden" name="list" value={list.uid} />
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input name="q" defaultValue={q} placeholder="Search product, SKU or category" className="h-10 w-full rounded-lg border border-input bg-background pr-3 pl-8 text-sm outline-none focus:border-foreground" />
        </form>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{list.name}</h2>
            {list.grp ? <span className="text-[13px] text-tertiary-foreground">· {list.grp}</span> : null}
          </div>
          <p className="text-[13px] text-tertiary-foreground">
            {priced} of {shown.length} SKUs priced · {customers.length} customer{customers.length === 1 ? "" : "s"}. An empty price means the SKU is not on this list - its customers pay the distributor price shown in grey.
          </p>
        </div>
        {canEdit ? <ListSettings uid={list.uid} name={list.name} grp={list.grp} /> : null}
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <Panel flush>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5">Product</th>
                  <th className="px-2 py-2.5 text-right">MRP</th>
                  <th className="px-2 py-2.5 text-right">Distributor</th>
                  <th className="px-2 py-2.5 text-right text-foreground">This list</th>
                  <th className="px-4 py-2.5 text-right">vs distributor</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((p, i) => {
                  const v = prices.get(p.uid) ?? null;
                  const diff = v !== null && p.db ? Math.round((v - p.db) * 100) / 100 : null;
                  return (
                    <FragmentRow key={p.uid} category={i === 0 || shown[i - 1].category !== p.category ? p.category : null} cols={5}>
                      <tr className={cn("border-t border-border hover:bg-muted/30", v !== null && "bg-primary/[0.03]")}>
                        <td className="min-w-64 px-4 py-2">
                          <div className="flex items-center gap-2">
                            <ProductThumb image={p.image} size={32} />
                            <div className="min-w-0">
                              <Link href={`/price-list/sku/${p.uid}`} className="font-medium text-foreground hover:underline">{p.name}</Link>
                              <div className="text-[11px] text-tertiary-foreground">
                                <span className="font-mono">{p.sku}</span>
                                <span className="num ml-2 rounded bg-muted px-1.5 text-muted-foreground" title="Pack quantity">{p.packQty ?? "—"}</span>
                                <span className="ml-1 rounded bg-muted px-1.5 text-muted-foreground" title="Unit">{p.unit ?? "—"}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="num px-2 py-2 text-right">₹{p.mrp}</td>
                        <td className="num px-2 py-2 text-right text-muted-foreground">{p.db ? `₹${p.db}` : "—"}</td>
                        <td className="px-2 py-2 text-right">
                          <PriceCell target={{ kind: "list", list: list.uid }} productUid={p.uid} value={v} fallback={p.db} canEdit={canEdit} clearable />
                          <div className="pr-2"><Margin pct={marginPct(v, p.mrp)} /></div>
                        </td>
                        <td className="num px-4 py-2 text-right text-[12px]">
                          {diff === null ? <span className="text-tertiary-foreground">—</span> : (
                            <span className={diff < 0 ? "text-emerald-700" : diff > 0 ? "text-amber-700" : "text-tertiary-foreground"}>
                              {diff === 0 ? "same" : `${diff < 0 ? "−" : "+"}₹${Math.abs(diff)}`}
                            </span>
                          )}
                        </td>
                      </tr>
                    </FragmentRow>
                  );
                })}
                {shown.length === 0 ? <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No products match.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title={<span className="inline-flex items-center gap-1.5"><Users className="size-4" /> Customers ({customers.length})</span>} description="Each customer is on one list at a time." className="xl:sticky xl:top-4">
          <div className="space-y-3">
            {canEdit ? <CustomerPicker listUid={list.uid} /> : null}
            <ul className="max-h-[60vh] divide-y divide-border overflow-y-auto text-[13px]">
              {customers.map((c) => (
                <li key={c.uid} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <Link href={`/price-list/customers/${c.uid}`} className="block truncate font-medium hover:underline">{c.name}</Link>
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
