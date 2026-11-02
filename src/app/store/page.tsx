import Link from "next/link";
import { Warehouse } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { canEditStore, num, str } from "@/lib/store/access";
import { getCategories, getStock, inr, qtyFmt } from "@/lib/store/data";

export const dynamic = "force-dynamic";

const box = "h-9 rounded-lg border border-input bg-transparent px-3 text-sm";

export default async function StorePage({ searchParams }: PageProps<"/store">) {
  const sp = await searchParams;
  const cat = num(sp.cat);
  const q = str(sp.q).trim().toLowerCase();
  const lowOnly = str(sp.low) === "1";
  const [all, categories, canEdit] = await Promise.all([getStock(), getCategories(), canEditStore()]);

  const isLow = (r: { active: boolean; stock: number; min_stock: number }) => r.active && r.min_stock > 0 && r.stock <= r.min_stock;
  const rows = all.filter((r) =>
    (!cat || r.category_id === cat) &&
    (!q || `${r.name} ${r.category} ${r.subcategory ?? ""}`.toLowerCase().includes(q)) &&
    (!lowOnly || isLow(r)));
  const totalValue = all.reduce((s, r) => s + r.value, 0);
  const lowCount = all.filter(isLow).length;

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-4">
        <PageHeader
          icon={Warehouse}
          title="Store"
          subtitle="Everything procured for the plant, what has come in, what has been issued and what is left."
          actions={canEdit ? (
            <>
              <Link href="/store/in" className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground">Add stock</Link>
              <Link href="/store/out" className="inline-flex h-8 items-center rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted">Issue stock</Link>
            </>
          ) : null}
        />
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["Items", String(all.length)],
            ["Low on stock", String(lowCount)],
            ["Stock value (at average purchase rate)", inr(totalValue)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-border p-3">
              <div className="text-xs text-muted-foreground">{k}</div>
              <div className="num mt-1 text-xl font-semibold">{v}</div>
            </div>
          ))}
        </div>
        <form className="flex flex-wrap items-end gap-2" method="get">
          <input name="q" defaultValue={str(sp.q)} placeholder="Search items" className={`${box} w-56`} />
          <select name="cat" defaultValue={cat ? String(cat) : ""} className={`${box} w-48`}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <label className="flex h-9 items-center gap-2 text-sm"><input type="checkbox" name="low" value="1" defaultChecked={lowOnly} /> Low stock only</label>
          <button className="h-9 rounded-lg border border-input px-4 text-sm font-medium hover:bg-muted">Filter</button>
        </form>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>{["Item", "Category", "Subcategory", "Total in", "Total out", "In stock", "Avg rate", "Value", "Last movement", ""].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={`border-t border-border ${r.active ? "" : "opacity-50"}`}>
                  <td className="px-3 py-2 font-medium">{r.name}</td>
                  <td className="px-3 py-2">{r.category}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.subcategory ?? "—"}</td>
                  <td className="num whitespace-nowrap px-3 py-2">{qtyFmt(r.qty_in)} {r.unit}</td>
                  <td className="num whitespace-nowrap px-3 py-2">{qtyFmt(r.qty_out)} {r.unit}</td>
                  <td className="num whitespace-nowrap px-3 py-2 font-semibold">
                    {qtyFmt(r.stock)} {r.unit}
                    {isLow(r) ? <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">Low</span> : null}
                  </td>
                  <td className="num px-3 py-2">{inr(r.avg_rate)}</td>
                  <td className="num px-3 py-2">{inr(r.value)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{r.last_day ? r.last_day.split("-").reverse().join("-") : "—"}</td>
                  <td className="px-3 py-2"><Link href={`/store/ledger?item=${r.id}`} className="text-xs underline">History</Link></td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr><td colSpan={10} className="px-3 py-10 text-center text-muted-foreground">
                  {all.length === 0 ? <>No items yet. Set up categories and items under <Link href="/store/items" className="underline">Categories &amp; items</Link>.</> : "Nothing matches this filter."}
                </td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
