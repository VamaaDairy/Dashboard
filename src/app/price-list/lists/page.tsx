import Link from "next/link";
import { cookies } from "next/headers";
import { MasterList, Thumb, type MasterItem } from "@/components/pricing/MasterList";
import { DetailHeading, Margin, NothingPicked, SUB, Split, Summary, T, money2 } from "@/components/pricing/ui";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { listCustomers, listPrices, priceLists, standardPrices, type PriceList } from "@/lib/price-list";
import { marginPct } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { CustomerPicker, ListSettings, NewList, PriceCell, RemoveCustomer } from "../editors";

export const dynamic = "force-dynamic";

const initials = (name: string) => name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

/**
 * Party price lists: special prices for chosen customers. The lists on the left; the one picked on the right with
 * a price per SKU (empty = not on the list, its customers pay their channel price) and the customers on it.
 */
export default async function PriceListsPage({ searchParams }: { searchParams: Promise<{ list?: string }> }) {
  const sp = await searchParams;
  const me = await userFromToken((await cookies()).get("session")?.value);
  const canEdit = !!me && atLeast(levelFor(me, "pricelist"), "edit");
  const lists = await priceLists();
  const list = lists.find((l) => l.uid === sp.list) ?? lists[0] ?? null;
  const groups = [...new Set(lists.map((l) => l.grp).filter((g): g is string => !!g))];

  const items: MasterItem[] = lists.map((l) => ({
    id: l.uid,
    href: `/price-list/lists?list=${l.uid}`,
    group: l.grp ?? "Other",
    title: l.name,
    sub: `${l.customers} customer${l.customers === 1 ? "" : "s"}`,
    right: String(l.priced),
    rightSub: "SKUs",
    initials: initials(l.name),
  }));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Summary items={[
          { value: String(lists.length), label: "party price lists" },
          { value: String(lists.reduce((a, l) => a + l.customers, 0)), label: "customers on a list" },
          { value: String(groups.length), label: "groups" },
        ]} />
        {canEdit ? <div className="w-56"><NewList groups={groups} /></div> : null}
      </div>
      <Split list={<MasterList items={items} selected={list?.uid ?? null} placeholder="Search price lists" />}>
        {list ? <ListDetail list={list} canEdit={canEdit} /> : <NothingPicked>No party price lists yet. Create one to give chosen customers their own prices.</NothingPicked>}
      </Split>
    </>
  );
}

async function ListDetail({ list, canEdit }: { list: PriceList; canEdit: boolean }) {
  const [products, prices, customers] = await Promise.all([standardPrices(), listPrices(list.uid), listCustomers(list.uid)]);
  const rows = products.filter((p) => p.inApp);
  const priced = rows.filter((p) => prices.has(p.uid)).length;

  return (
    <div className="px-6 py-7 xl:px-9">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-[20px] font-semibold tracking-tight text-foreground">{list.name}</h2>
          <div className={cn("tabular-nums mt-1 text-[13px]", SUB)}>
            {list.grp ?? "No group"} · {priced} of {rows.length} SKUs priced · {customers.length} customer{customers.length === 1 ? "" : "s"}
          </div>
        </div>
        {canEdit ? <ListSettings uid={list.uid} name={list.name} grp={list.grp} /> : null}
      </div>

      <div className="grid gap-x-12 min-[1700px]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div>
          <DetailHeading note="Empty = not on this list; its customers pay the distributor price">Prices</DetailHeading>
          <table className={cn(T.table, "tabular-nums")}>
            <thead>
              <tr>
                <th className={T.th}>SKU</th>
                <th className={cn(T.th, "text-right")}>MRP</th>
                <th className={cn(T.th, "text-right")}>Distributor</th>
                <th className={cn(T.th, "text-right")}>This list</th>
                <th className={cn(T.th, "text-right")}>Margin</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p, i) => {
                const v = prices.get(p.uid) ?? null;
                const diff = v !== null && p.db ? Math.round((v - p.db) * 100) / 100 : null;
                const newCat = i === 0 || rows[i - 1].category !== p.category;
                return [
                  newCat ? (
                    <tr key={`c-${p.category}`}><td colSpan={5} className="pt-4 pb-1 text-[12px] font-medium text-foreground/75">{p.category}</td></tr>
                  ) : null,
                  <tr key={p.uid}>
                    <td className={T.td}>
                      <Link href={`/price-list?sku=${p.uid}`} className="flex items-center gap-2.5">
                        <Thumb image={p.image} size={28} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-foreground hover:underline">{p.name}</span>
                          <span className={cn("block text-[12px]", SUB)}>{p.sku} · {[p.packQty, p.unit].filter(Boolean).join(" ")}</span>
                        </span>
                      </Link>
                    </td>
                    <td className={cn(T.td, "text-right text-foreground")}>{money2(p.mrp)}</td>
                    <td className={cn(T.td, "text-right", SUB)}>{money2(p.db)}</td>
                    <td className={cn(T.td, "text-right")}>
                      <PriceCell target={{ kind: "list", list: list.uid }} productUid={p.uid} value={v} fallback={p.db} canEdit={canEdit} clearable />
                      {diff ? <div className={cn("pr-2 text-[12px]", SUB)}>{diff > 0 ? "+" : "−"}{money2(Math.abs(diff))} vs distributor</div> : null}
                    </td>
                    <td className={cn(T.td, "text-right")}><Margin pct={marginPct(v, p.mrp)} label="" /></td>
                  </tr>,
                ];
              })}
            </tbody>
          </table>
        </div>
        <div>
          <DetailHeading note="Each customer is on one list at a time">Customers</DetailHeading>
          {canEdit ? <div className="mb-2"><CustomerPicker listUid={list.uid} /></div> : null}
          <ul className="text-[13px]">
            {customers.map((c) => (
              <li key={c.uid} className="flex items-center justify-between gap-2 border-b border-foreground/10 py-2.5">
                <div className="min-w-0">
                  <Link href={`/price-list/customers?c=${c.uid}`} className="block truncate font-medium text-foreground hover:underline">{c.name}</Link>
                  <div className={cn("truncate text-[12px]", SUB)}>{c.code} · {[c.channel, c.city].filter(Boolean).join(", ")}{c.active ? "" : " · inactive"}</div>
                </div>
                {canEdit ? <RemoveCustomer listUid={list.uid} firmUid={c.uid} name={c.name} /> : null}
              </li>
            ))}
            {customers.length === 0 ? <li className={cn("py-2", SUB)}>No customers on this list yet.</li> : null}
          </ul>
        </div>
      </div>
    </div>
  );
}
