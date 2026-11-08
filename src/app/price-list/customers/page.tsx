import Link from "next/link";
import { cookies } from "next/headers";
import { MasterList, Thumb, type MasterItem } from "@/components/pricing/MasterList";
import { DetailHeading, Margin, NothingPicked, SUB, Split, Summary, T, money2 } from "@/components/pricing/ui";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { priceLists } from "@/lib/price-list";
import { customerSheet, marginPct, pricedCustomers, type CustomerSheet } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { CustomerListSelect } from "../editors";

export const dynamic = "force-dynamic";

const initials = (name: string) => name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
const FROM = { list: "Price list", channel: "Channel price", product: "Base DP" } as const;

/**
 * Customers: every trade customer on the left; the one picked on the right with exactly what the Gaia app charges
 * them for each SKU (the same code their orders use), where each price comes from, and the list they are on.
 */
export default async function CustomerPricesPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const sp = await searchParams;
  const me = await userFromToken((await cookies()).get("session")?.value);
  const canEdit = !!me && atLeast(levelFor(me, "pricelist"), "edit");
  const [customers, lists] = await Promise.all([pricedCustomers({}), priceLists()]);
  const picked = customers.find((c) => c.uid === sp.c)?.uid ?? (sp.c && /^[0-9a-f-]{36}$/i.test(sp.c) ? sp.c : customers[0]?.uid ?? null);
  const sheet = picked ? await customerSheet(picked) : null;
  const onList = customers.filter((c) => c.listUid).length;

  const items: MasterItem[] = customers.map((c) => ({
    id: c.uid,
    href: `/price-list/customers?c=${c.uid}`,
    group: c.channel ?? "Other",
    title: c.name,
    sub: [c.code, c.city, c.list].filter(Boolean).join(" · ") + (c.active ? "" : " · inactive"),
    initials: initials(c.name),
    keywords: c.list ?? "",
  }));
  const channelNames = [...new Set(customers.map((c) => c.channel ?? "Other"))];

  return (
    <>
      <Summary items={[
        { value: customers.length.toLocaleString("en-IN"), label: customers.length >= 1000 ? "customers (first 1,000)" : "trade customers" },
        { value: onList.toLocaleString("en-IN"), label: "on a party price list" },
        { value: (customers.length - onList).toLocaleString("en-IN"), label: "on channel prices" },
      ]} />
      <Split
        list={
          <MasterList
            items={items}
            selected={picked}
            placeholder="Search name, code, city or list"
            filters={{ label: "Channel", value: "", options: [{ value: "", label: "All channels" }, ...channelNames.map((c) => ({ value: c, label: c }))] }}
          />
        }
      >
        {sheet ? <Sheet sheet={sheet} lists={lists} canEdit={canEdit} /> : <NothingPicked>No trade customers yet.</NothingPicked>}
      </Split>
    </>
  );
}

function Sheet({ sheet, lists, canEdit }: { sheet: CustomerSheet; lists: Awaited<ReturnType<typeof priceLists>>; canEdit: boolean }) {
  const c = sheet.customer;
  const priced = sheet.rows.filter((r) => r.pays);
  const special = priced.filter((r) => r.pays?.source === "list").length;
  const margins = priced.map((r) => marginPct(r.pays?.price, r.product.mrp)).filter((m): m is number => m !== null);
  const avg = margins.length ? Math.round((margins.reduce((a, b) => a + b, 0) / margins.length) * 10) / 10 : null;

  return (
    <div className="px-6 py-7 xl:px-9">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="flex items-center gap-4">
          <Thumb initials={initials(c.name)} size={52} />
          <div className="min-w-0">
            <h2 className="text-[20px] font-semibold tracking-tight text-foreground">{c.name}</h2>
            <div className={cn("tabular-nums mt-1 text-[13px]", SUB)}>
              {[c.code, c.channel, c.city, c.phone].filter(Boolean).join(" · ")}{c.servedBy ? ` · served by ${c.servedBy}` : ""}{c.active ? "" : " · inactive"}
            </div>
            <Link href={`/customers/firm/${c.uid}`} className="text-[13px] font-medium text-primary hover:underline">Customer profile</Link>
          </div>
        </div>
        <div>
          <div className="mb-1 text-[12px] font-medium text-foreground/75">Price list</div>
          {canEdit ? <CustomerListSelect firmUid={c.uid} current={c.listUid} lists={lists} /> : <div className="text-[14px] font-medium text-foreground">{c.list ?? "None, pays channel prices"}</div>}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-foreground/10 bg-foreground/10">
        {[
          { l: "SKUs they can order", v: String(priced.length), n: `${sheet.rows.length - priced.length} without a price are hidden from them` },
          { l: "Special prices", v: String(special), n: c.list ? `from ${c.list}` : "not on a party list" },
          { l: "Average margin below MRP", v: avg === null ? "—" : `${avg}%`, n: "across the SKUs they can order" },
        ].map((f) => (
          <div key={f.l} className="bg-card px-5 py-4">
            <div className="text-[12px] font-medium text-foreground/75">{f.l}</div>
            <div className="tabular-nums mt-1.5 text-[22px] font-semibold tracking-tight text-foreground">{f.v}</div>
            <div className="mt-1 text-[12px] text-foreground/75">{f.n}</div>
          </div>
        ))}
      </div>

      <DetailHeading note="Their list first, then their channel price, then the product's base DP">What they pay</DetailHeading>
      <table className={cn(T.table, "tabular-nums")}>
        <thead>
          <tr>
            <th className={T.th}>SKU</th>
            <th className={cn(T.th, "text-right")}>MRP</th>
            <th className={cn(T.th, "text-right")}>Channel</th>
            <th className={cn(T.th, "text-right")}>They pay</th>
            <th className={T.th}>From</th>
            <th className={cn(T.th, "text-right")}>Margin</th>
          </tr>
        </thead>
        <tbody>
          {sheet.rows.map((r, i) => {
            const p = r.product;
            const diff = r.pays && r.channelPrice ? Math.round((r.pays.price - r.channelPrice) * 100) / 100 : null;
            const newCat = i === 0 || sheet.rows[i - 1].product.category !== p.category;
            return [
              newCat ? <tr key={`c-${p.category}`}><td colSpan={6} className="pt-4 pb-1 text-[12px] font-medium text-foreground/75">{p.category}</td></tr> : null,
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
                <td className={cn(T.td, "text-right", SUB)}>{money2(r.channelPrice)}</td>
                <td className={cn(T.td, "whitespace-nowrap text-right")}>
                  {r.pays ? <span className="font-semibold text-foreground">{money2(r.pays.price)}</span> : <span className={SUB}>Hidden, no price</span>}
                  {diff ? <div className={cn("whitespace-nowrap text-[12px]", SUB)} title="Compared with their channel price">{diff > 0 ? "+" : "−"}{money2(Math.abs(diff))}</div> : null}
                </td>
                <td className={cn(T.td, "max-w-40 truncate whitespace-nowrap text-foreground")}>
                  {r.pays ? (
                    <span className="inline-flex items-center gap-1.5">
                      {r.pays.source === "list" ? <span className="size-1.5 rounded-full bg-primary" aria-hidden /> : null}
                      {r.pays.source === "list" && r.pays.list ? r.pays.list : FROM[r.pays.source]}
                    </span>
                  ) : null}
                </td>
                <td className={cn(T.td, "text-right")}><Margin pct={marginPct(r.pays?.price, p.mrp)} label="" /></td>
              </tr>,
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}
