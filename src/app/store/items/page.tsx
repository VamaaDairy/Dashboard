import { Tags } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { AddCategoryForm, AddItemForm, AddSubcategoryForm, GroupActions, ItemActions } from "@/components/store/StoreForms";
import { canEditStore } from "@/lib/store/access";
import { getCategories, getStock, getSubcategories, qtyFmt, UNITS } from "@/lib/store/data";

export const dynamic = "force-dynamic";

export default async function StoreItemsPage() {
  const [categories, subcategories, items, canEdit] = await Promise.all([getCategories(), getSubcategories(), getStock(), canEditStore()]);

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-4">
        <PageHeader
          icon={Tags}
          title="Categories & items"
          subtitle="Set these up first: a category, optionally a subcategory under it, then the items you procure. Stock can only be entered against an item."
        />
        {canEdit ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3"><AddCategoryForm /><AddSubcategoryForm categories={categories} /></div>
            <AddItemForm categories={categories} subcategories={subcategories} units={UNITS} />
          </div>
        ) : null}

        {categories.length === 0 ? <p className="rounded-lg border border-border px-3 py-10 text-center text-sm text-muted-foreground">No categories yet. Add the first one above.</p> : null}

        {categories.map((c) => {
          const its = items.filter((i) => i.category_id === c.id);
          const subs = subcategories.filter((s) => s.category_id === c.id);
          return (
            <section key={c.id} className="rounded-lg border border-border">
              <header className="border-b border-border bg-muted/40 px-3 py-2">
                <h2 className="inline text-sm font-semibold">{c.name}</h2>
                <span className="ml-2 text-xs text-muted-foreground">{its.length} item{its.length === 1 ? "" : "s"}</span>
                {canEdit ? <GroupActions kind="category" id={c.id} name={c.name} items={its.length + subs.length} /> : null}
                {subs.length ? (
                  <div className="mt-1 text-xs text-muted-foreground">
                    Subcategories:{" "}
                    {subs.map((s) => (
                      <span key={s.id} className="mr-3 inline-block">{s.name} ({s.items}){canEdit ? <GroupActions kind="subcategory" id={s.id} name={s.name} items={s.items} /> : null}</span>
                    ))}
                  </div>
                ) : null}
              </header>
              <table className="w-full text-sm">
                <tbody>
                  {its.map((i) => (
                    <tr key={i.id} className={`border-t border-border first:border-t-0 ${i.active ? "" : "opacity-50"}`}>
                      <td className="px-3 py-2 font-medium">{i.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{i.subcategory ?? "—"}</td>
                      <td className="px-3 py-2">{i.unit}</td>
                      <td className="num px-3 py-2">{qtyFmt(i.stock)} in stock</td>
                      <td className="num px-3 py-2 text-muted-foreground">low at {qtyFmt(i.min_stock)}</td>
                      <td className="px-3 py-2">{canEdit ? <ItemActions id={i.id} active={i.active} minStock={i.min_stock} /> : null}</td>
                    </tr>
                  ))}
                  {its.length === 0 ? <tr><td className="px-3 py-4 text-sm text-muted-foreground">No items in this category yet.</td></tr> : null}
                </tbody>
              </table>
            </section>
          );
        })}
      </div>
    </div>
  );
}
