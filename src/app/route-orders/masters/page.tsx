import Link from "next/link";
import { labelOf, productLabels } from "@/lib/products/names";
import { ProductCell } from "@/components/products/Product";
import { cookies } from "next/headers";
import { Settings2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Panel, Pill } from "@/components/cn/ui";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { CHANNELS, listParties, listProducts, listRoutes, unmatchedFirms, unmatchedSkus } from "@/lib/route-orders/data";
import { linkFirm, saveParty, saveProduct } from "../actions";
import { Chip, Notice } from "../parts";
import { TallyTab } from "./tally-tab";

export const dynamic = "force-dynamic";

const inputCls = "mt-1 block h-9 w-full rounded-lg border border-input bg-background px-3 text-sm font-normal outline-none focus:border-primary";

function Text({ label, name, value, type }: { label: string; name: string; value?: string | number | null; type?: string }) {
  return <label className="text-xs font-medium">{label}<input name={name} type={type ?? "text"} step={type === "number" ? "any" : undefined} defaultValue={value ?? ""} className={inputCls} /></label>;
}

function Area({ label, name, value }: { label: string; name: string; value?: string | null }) {
  return <label className="text-xs font-medium">{label}<textarea name={name} rows={2} defaultValue={value ?? ""} className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-normal outline-none focus:border-primary" /></label>;
}

export default async function MastersPage({ searchParams }: { searchParams: Promise<{ tab?: string; edit?: string; q?: string; msg?: string; error?: string }> }) {
  const sp = await searchParams;
  const tab = sp.tab === "customers" || sp.tab === "products" || sp.tab === "tally" ? sp.tab : "fix";
  const me = await userFromToken((await cookies()).get("session")?.value);
  const canEdit = !!me && atLeast(levelFor(me, "routeorders.masters"), "edit");
  const [parties, products, routes, firms, skus, labels] = await Promise.all([listParties(), listProducts(), listRoutes(), unmatchedFirms(), unmatchedSkus(), productLabels()]);

  const q = (sp.q ?? "").trim().toLowerCase();
  const shownParties = q ? parties.filter((p) => [p.name, p.tally_ledger, p.route, p.channel, p.group_name].some((x) => x?.toLowerCase().includes(q))) : parties;
  const flagged = parties.filter((p) => p.active && (!p.tally_ledger || !p.state || !p.route_id || p.review_note));
  const noItem = products.filter((p) => p.active && (!p.tally_item || !p.tally_ledger || !p.tally_unit));
  const fixCount = firms.length + skus.length + flagged.length + noItem.length;
  const editing = sp.edit === "new" ? null : parties.find((p) => String(p.id) === sp.edit);
  const editingProduct = products.find((p) => String(p.id) === sp.edit);
  const newParty = tab === "customers" && sp.edit === "new";

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-4">
        <PageHeader icon={Settings2} title="Customers & products" subtitle="One name for each customer and product, and what each is called in Tally." />
        <div className="flex flex-wrap gap-1.5">
          <Chip href="/route-orders/masters" on={tab === "fix"}>To fix <span className="ml-1 opacity-70">{fixCount}</span></Chip>
          <Chip href="/route-orders/masters?tab=customers" on={tab === "customers"}>Customers <span className="ml-1 opacity-70">{parties.length}</span></Chip>
          <Chip href="/route-orders/masters?tab=products" on={tab === "products"}>Products <span className="ml-1 opacity-70">{products.length}</span></Chip>
          <Chip href="/route-orders/masters?tab=tally" on={tab === "tally"}>Tally names</Chip>
        </div>
        {sp.msg ? <Notice tone="ok">{sp.msg}</Notice> : null}
        {sp.error ? <Notice tone="error">{sp.error}</Notice> : null}

        {tab === "fix" ? (
          <div className="space-y-5">
            <Panel title="Firms not matched to a customer" description="They ordered in the last 90 days. A firm matches by itself when its name is the same as a customer's. Otherwise pick the customer here." flush>
              {firms.length ? (
                <ul className="divide-y divide-border text-sm">
                  {firms.map((f) => (
                    <li key={f.uid} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                      <div className="min-w-64 flex-1"><span className="font-medium">{f.name}</span><div className="text-xs text-muted-foreground">{[f.code, f.city].filter(Boolean).join(" · ")} · {f.orders} order{f.orders === 1 ? "" : "s"}</div></div>
                      {canEdit ? (
                        <form action={linkFirm} className="flex items-center gap-2">
                          <input type="hidden" name="firm" value={f.uid} />
                          <input name="party" list="party-names" required placeholder="Type a customer name" aria-label={`Customer for ${f.name}`} className="h-9 w-72 rounded-lg border border-input bg-background px-3 text-sm" />
                          <Button type="submit" variant="outline" size="sm">Link</Button>
                        </form>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : <p className="px-4 py-5 text-center text-sm text-muted-foreground">Every firm that has ordered is matched.</p>}
              <datalist id="party-names">{parties.filter((p) => p.active).map((p) => <option key={p.id} value={p.name} />)}</datalist>
            </Panel>

            {skus.length ? (
              <Panel title="SKUs not in the product master" description="These lines can't be billed. Their SKU code's digits need to match a product's SKU number." flush>
                <ul className="divide-y divide-border text-sm">
                  {skus.map((s) => <li key={s.sku} className="px-4 py-2.5"><span className="font-mono text-xs">{s.sku}</span> <span className="font-medium">{s.name}</span> <span className="text-xs text-muted-foreground">· on {s.orders} order line{s.orders === 1 ? "" : "s"}</span></li>)}
                </ul>
              </Panel>
            ) : null}

            {noItem.length ? (
              <Panel title="Products with no Tally item" flush>
                <ul className="divide-y divide-border text-sm">
                  {noItem.map((p) => <li key={p.id} className="flex items-center justify-between px-4 py-2.5"><span className="font-medium">{p.name}</span><Link href={`/route-orders/masters?tab=products&edit=${p.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>Edit</Link></li>)}
                </ul>
              </Panel>
            ) : null}

            {flagged.length ? (
              <Panel title="Customers to check" description="Brought over from the workbook with something missing or marked for review. Those with no ledger or state can't be billed." flush>
                <ul className="divide-y divide-border text-sm">
                  {flagged.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                      <div className="min-w-64 flex-1">
                        <span className="font-medium">{p.name}</span>
                        <div className="text-xs text-muted-foreground">{[!p.tally_ledger && "No Tally ledger", !p.state && "No state", !p.route_id && "No route", p.review_note].filter(Boolean).join(" · ")}</div>
                      </div>
                      <Link href={`/route-orders/masters?tab=customers&edit=${p.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>Edit</Link>
                    </li>
                  ))}
                </ul>
              </Panel>
            ) : null}
          </div>
        ) : null}

        {tab === "customers" ? (
          <div className="space-y-4">
            {canEdit && (editing || newParty) ? (
              <Panel title={editing ? `Edit ${editing.name}` : "New customer"}>
                <form action={saveParty} className="grid gap-3 md:grid-cols-3">
                  <input type="hidden" name="id" value={editing?.id ?? ""} />
                  <Text label="Name" name="name" value={editing?.name} />
                  <label className="text-xs font-medium">Route
                    <select name="route_id" defaultValue={editing?.route_id ?? ""} className={inputCls}>
                      <option value="">No route</option>
                      {routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-medium">Channel
                    <select name="channel" defaultValue={editing?.channel ?? "GT"} className={inputCls}>{CHANNELS.map((c) => <option key={c}>{c}</option>)}</select>
                  </label>
                  <Text label="Tally ledger (exactly as in Tally)" name="tally_ledger" value={editing?.tally_ledger} />
                  <Text label="State" name="state" value={editing?.state} />
                  <Text label="Group" name="group_name" value={editing?.group_name} />
                  <Area label="Buyer address" name="buyer_address" value={editing?.buyer_address} />
                  <Text label="Buyer GSTIN" name="buyer_gstin" value={editing?.buyer_gstin} />
                  <Text label="Buyer pincode" name="buyer_pincode" value={editing?.buyer_pincode} />
                  <Text label="Consignee name" name="consignee_name" value={editing?.consignee_name} />
                  <Area label="Consignee address" name="consignee_address" value={editing?.consignee_address} />
                  <Text label="Consignee state" name="consignee_state" value={editing?.consignee_state} />
                  <Text label="Consignee pincode" name="consignee_pincode" value={editing?.consignee_pincode} />
                  <Text label="Consignee GSTIN" name="consignee_gstin" value={editing?.consignee_gstin} />
                  <Text label="Note to check (clear when done)" name="review_note" value={editing?.review_note} />
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="consolidated" defaultChecked={editing?.consolidated} /> Stockist: one bill per ledger across outlets</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={editing?.active ?? true} /> Active</label>
                  <div className="flex items-center gap-2 md:col-span-3">
                    <Button type="submit">Save</Button>
                    <Link href="/route-orders/masters?tab=customers" className={buttonVariants({ variant: "outline" })}>Close</Link>
                  </div>
                </form>
              </Panel>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <form action="/route-orders/masters" className="flex items-center gap-2">
                <input type="hidden" name="tab" value="customers" />
                <input name="q" defaultValue={sp.q} placeholder="Search name, ledger, route, channel" className="h-9 w-80 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary" />
                <button className="h-9 rounded-lg border border-border px-3 text-sm hover:bg-muted">Search</button>
              </form>
              {canEdit ? <Link href="/route-orders/masters?tab=customers&edit=new" className={buttonVariants({ size: "sm" })}>New customer</Link> : null}
            </div>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                  <tr>{["Customer", "Route", "Channel", "Tally ledger", "GSTIN", "Linked firm", ""].map((h, i) => <th key={i} className="whitespace-nowrap px-3 py-2 font-semibold">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {shownParties.map((p) => (
                    <tr key={p.id} className="border-t border-border hover:bg-muted/40">
                      <td className="min-w-56 px-3 py-2 font-medium">{p.name}{!p.active ? <Pill className="ml-2">Inactive</Pill> : null}{p.consolidated ? <Pill dot={false} className="ml-2">Stockist</Pill> : null}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{p.route ?? "-"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{p.channel}</td>
                      <td className="min-w-48 px-3 py-2">{p.tally_ledger ?? <span className="text-destructive">Missing</span>}</td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{p.buyer_gstin ?? "-"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{p.firm ?? "-"}</td>
                      <td className="px-3 py-2">{canEdit ? <Link href={`/route-orders/masters?tab=customers&edit=${p.id}`} className="text-primary hover:underline">Edit</Link> : null}</td>
                    </tr>
                  ))}
                  {shownParties.length === 0 ? <tr><td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">No customers match.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {tab === "products" ? (
          <div className="space-y-4">
            {canEdit && editingProduct ? (
              <Panel title={`Edit ${editingProduct.name}`} description={`SKU ${editingProduct.sku_no}`}>
                <form action={saveProduct} className="grid gap-3 md:grid-cols-3">
                  <input type="hidden" name="id" value={editingProduct.id} />
                  {/* the name is the Product Master's (one name everywhere); only the billing settings are kept here */}
                  <label className="text-xs font-medium">Name (from the Product Master)
                    <input name="name" readOnly value={editingProduct.name} className={`${inputCls} cursor-not-allowed bg-muted`} />
                  </label>
                  <Text label="Category" name="category" value={editingProduct.category} />
                  <Text label="Tally stock item (exactly as in Tally)" name="tally_item" value={editingProduct.tally_item} />
                  <Text label="Tally sales ledger" name="tally_ledger" value={editingProduct.tally_ledger} />
                  <Text label="Tally unit" name="tally_unit" value={editingProduct.tally_unit} />
                  <Text label="Pieces in that unit" name="pack_size" type="number" value={editingProduct.pack_size} />
                  <label className="text-xs font-medium">GST
                    <select name="gst_pct" defaultValue={String(Number(editingProduct.gst_pct))} className={inputCls}><option value="0">0%</option><option value="5">5%</option></select>
                  </label>
                  <Text label="Shelf life (days)" name="shelf_days" type="number" value={editingProduct.shelf_days} />
                  <Text label="Weight of a piece (kg)" name="weight_kg" type="number" value={editingProduct.weight_kg} />
                  <Text label="Stock app product id" name="stock_id" value={editingProduct.stock_id} />
                  <div className="flex items-center gap-2 md:col-span-3">
                    <Button type="submit">Save</Button>
                    <Link href="/route-orders/masters?tab=products" className={buttonVariants({ variant: "outline" })}>Close</Link>
                  </div>
                </form>
              </Panel>
            ) : null}
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                  <tr>{["Product", "Pack qty", "Unit", "Name on this list", "Category", "Tally item", "Sales ledger", "Tally unit", "Pieces", "GST", "Shelf", "Kg/pc", ""].map((h, i) => <th key={i} className="whitespace-nowrap px-3 py-2 font-semibold">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} className="border-t border-border hover:bg-muted/40">
                      <td className="min-w-64 px-3 py-2"><ProductCell p={labelOf(labels, p.sku_no, p.name)} /></td>
                      <td className="num whitespace-nowrap px-3 py-2">{labelOf(labels, p.sku_no, p.name).qty ?? "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2">{labelOf(labels, p.sku_no, p.name).unit ?? "—"}</td>
                      <td className="min-w-48 px-3 py-2 text-muted-foreground">{p.name}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{p.category}</td>
                      <td className="min-w-56 px-3 py-2">{p.tally_item ?? <span className="text-destructive">Missing</span>}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{p.tally_ledger ?? "-"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{p.tally_unit ?? "-"}</td>
                      <td className="num px-3 py-2">{Number(p.pack_size)}</td>
                      <td className="num px-3 py-2">{Number(p.gst_pct)}%</td>
                      <td className="num px-3 py-2">{p.shelf_days}d</td>
                      <td className="num px-3 py-2">{Number(p.weight_kg)}</td>
                      <td className="px-3 py-2">{canEdit ? <Link href={`/route-orders/masters?tab=products&edit=${p.id}`} className="text-primary hover:underline">Edit</Link> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {tab === "tally" ? <TallyTab canEdit={canEdit} /> : null}
      </div>
    </div>
  );
}