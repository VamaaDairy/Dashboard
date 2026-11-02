import { BookOpen } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { MovementTable } from "@/components/store/MovementTable";
import { canEditStore, dateOnly, num, str } from "@/lib/store/access";
import { getCategories, getMovements, getStock } from "@/lib/store/data";

export const dynamic = "force-dynamic";

const box = "h-9 rounded-lg border border-input bg-transparent px-3 text-sm";

export default async function StoreLedgerPage({ searchParams }: PageProps<"/store/ledger">) {
  const sp = await searchParams;
  const item = num(sp.item);
  const category = num(sp.cat);
  const direction = str(sp.dir) === "in" ? "in" : str(sp.dir) === "out" ? "out" : undefined;
  const from = dateOnly(sp.from);
  const to = dateOnly(sp.to);
  const [rows, items, categories, canEdit] = await Promise.all([
    getMovements({ item, category, direction, from, to, limit: 500 }), getStock(), getCategories(), canEditStore(),
  ]);
  const bought = rows.filter((r) => r.direction === "in").reduce((s, r) => s + (r.rate != null ? r.qty * r.rate : 0), 0);

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-4">
        <PageHeader icon={BookOpen} title="Store ledger" subtitle="Every entry and exit, newest first. Filter by item, category, type or dates." />
        <form className="flex flex-wrap items-end gap-2" method="get">
          <label className="text-xs text-muted-foreground">Item
            <select name="item" defaultValue={item ? String(item) : ""} className={`${box} mt-1 block w-56`}>
              <option value="">All items</option>
              {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </label>
          <label className="text-xs text-muted-foreground">Category
            <select name="cat" defaultValue={category ? String(category) : ""} className={`${box} mt-1 block w-44`}>
              <option value="">All</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="text-xs text-muted-foreground">Type
            <select name="dir" defaultValue={direction ?? ""} className={`${box} mt-1 block w-32`}>
              <option value="">In &amp; out</option><option value="in">In only</option><option value="out">Out only</option>
            </select>
          </label>
          <label className="text-xs text-muted-foreground">From<input type="date" name="from" defaultValue={from} className={`${box} mt-1 block w-40`} /></label>
          <label className="text-xs text-muted-foreground">To<input type="date" name="to" defaultValue={to} className={`${box} mt-1 block w-40`} /></label>
          <button className="h-9 rounded-lg border border-input px-4 text-sm font-medium hover:bg-muted">Filter</button>
        </form>
        <p className="text-sm text-muted-foreground">
          {rows.length} entr{rows.length === 1 ? "y" : "ies"}{rows.length === 500 ? " (latest 500 shown)" : ""} · purchases in this list ₹{bought.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
        </p>
        <MovementTable rows={rows} canEdit={canEdit} empty="No entries match this filter." />
      </div>
    </div>
  );
}
