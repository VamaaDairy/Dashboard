import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { ArrowLeft, Building2, ListChecks, Tags, TrendingUp } from "lucide-react";
import { ProductThumb } from "@/components/products/Product";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, Pill, StatCard } from "@/components/cn/ui";
import { Margin, PricingTabs, SourceBadge, money } from "@/components/pricing/PricingTabs";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { priceLists } from "@/lib/price-list";
import { customerSheet, marginPct } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { CustomerCheckPicker, CustomerListSelect } from "../../editors";

export const dynamic = "force-dynamic";

/**
 * One customer's price sheet: every SKU in the apps with what the Gaia app charges this customer (the same code its
 * orders use), where the price comes from, the margin it leaves below MRP and how it compares with their channel price.
 */
export default async function CustomerSheetPage({ params, searchParams }: { params: Promise<{ uid: string }>; searchParams: Promise<{ q?: string; only?: string }> }) {
  const [{ uid }, sp] = await Promise.all([params, searchParams]);
  const [sheet, lists] = await Promise.all([customerSheet(uid), priceLists()]);
  if (!sheet) notFound();
  const me = await userFromToken((await cookies()).get("session")?.value);
  const canEdit = !!me && atLeast(levelFor(me, "pricelist"), "edit");
  const c = sheet.customer;
  const q = sp.q?.trim().toLowerCase() ?? "";
  const rows = sheet.rows.filter((r) =>
    (!q || `${r.product.sku} ${r.product.name} ${r.product.category}`.toLowerCase().includes(q)) &&
    (sp.only !== "special" || r.pays?.source === "list"),
  );
  const priced = sheet.rows.filter((r) => r.pays);
  const special = priced.filter((r) => r.pays?.source === "list").length;
  const margins = priced.map((r) => marginPct(r.pays?.price, r.product.mrp)).filter((m): m is number => m !== null);
  const avg = margins.length ? Math.round((margins.reduce((a, b) => a + b, 0) / margins.length) * 10) / 10 : null;
  const link = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: sp.q, only: sp.only, ...patch })) if (v) p.set(k, v);
    return p.size ? `/price-list/customers/${uid}?${p}` : `/price-list/customers/${uid}`;
  };

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <PageHeader
          icon={Tags}
          title="Customer price sheet"
          subtitle="Exactly what the Gaia app charges this customer for each SKU, and why."
          actions={<Link href="/price-list/customers" className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> All customers</Link>}
        />
        <PricingTabs on="customers" />

        <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-xs lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Building2 className="size-5" /></span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold leading-tight">{c.name}</h2>
                {c.active ? <Pill tone="success">Active</Pill> : <Pill>Inactive</Pill>}
              </div>
              <div className="mt-0.5 text-[13px] text-tertiary-foreground">
                <span className="font-mono">{c.code}</span> · {[c.channel, c.city].filter(Boolean).join(" · ")}
                {c.servedBy ? <> · served by {c.servedBy}</> : null}
                {c.phone ? <> · {c.phone}</> : null}
              </div>
              <Link href={`/customers/firm/${c.uid}`} className="text-[12px] text-primary hover:underline">Customer profile</Link>
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-tertiary-foreground">Price list</div>
            {canEdit ? <CustomerListSelect firmUid={c.uid} current={c.listUid} lists={lists} /> : (
              <div className="text-sm font-medium">{c.list ?? "No list - channel prices"}</div>
            )}
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={Tags} label="SKUs they can order" value={String(priced.length)} note={`${sheet.rows.length - priced.length} with no price (hidden)`} />
          <StatCard icon={ListChecks} label="Special prices" value={String(special)} tone="brand" note={c.list ? `from ${c.list}` : "not on a party list"} href={link({ only: "special" })} />
          <StatCard icon={TrendingUp} label="Avg margin below MRP" value={avg === null ? "—" : `${avg}%`} tone="success" />
          <div className="rounded-lg border border-border bg-card px-4 py-3.5 shadow-xs">
            <div className="text-[12px] font-medium text-tertiary-foreground">Check another customer</div>
            <div className="mt-2"><CustomerCheckPicker current={c.uid} className="relative w-full" /></div>
          </div>
        </div>

        <Panel flush>
          <div className="flex flex-col gap-3 border-b border-border p-3 md:flex-row md:items-center">
            <form action={`/price-list/customers/${uid}`} className="md:w-80">
              {sp.only ? <input type="hidden" name="only" value={sp.only} /> : null}
              <input name="q" defaultValue={sp.q} placeholder="Filter SKUs" className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-foreground" />
            </form>
            <div className="flex gap-1.5 md:ml-auto">
              {[["", "All SKUs"], ["special", "Special prices only"]].map(([v, l]) => (
                <Link key={v} href={link({ only: v || undefined })} className={cn("rounded-full border px-2.5 py-1 text-[12px]", (sp.only ?? "") === v ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted")}>{l}</Link>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5">Product</th>
                  <th className="px-2 py-2.5 text-right">MRP</th>
                  <th className="px-2 py-2.5 text-right">Channel price</th>
                  <th className="px-2 py-2.5 text-right text-foreground">They pay</th>
                  <th className="px-2 py-2.5">From</th>
                  <th className="px-2 py-2.5 text-right">Margin</th>
                  <th className="px-4 py-2.5 text-right">Packaging / pc</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const p = r.product;
                  const diff = r.pays && r.channelPrice ? Math.round((r.pays.price - r.channelPrice) * 100) / 100 : null;
                  return (
                    <SheetRow key={p.uid} category={i === 0 || rows[i - 1].product.category !== p.category ? p.category : null}>
                      <tr className={cn("border-t border-border hover:bg-muted/30", !r.pays && "text-muted-foreground")}>
                        <td className="min-w-64 px-4 py-2">
                          <div className="flex items-center gap-2">
                            <ProductThumb image={p.image} size={32} />
                            <div className="min-w-0">
                              <Link href={`/price-list/sku/${p.uid}`} className="font-medium hover:underline">{p.name}</Link>
                              <div className="text-[11px] text-tertiary-foreground">
                                <span className="font-mono">{p.sku}</span>
                                <span className="num ml-2 rounded bg-muted px-1.5 text-muted-foreground">{p.packQty ?? "—"}</span>
                                <span className="ml-1 rounded bg-muted px-1.5 text-muted-foreground">{p.unit ?? "—"}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="num px-2 py-2 text-right">{money(p.mrp)}</td>
                        <td className="num px-2 py-2 text-right text-muted-foreground">{money(r.channelPrice)}</td>
                        <td className="num px-2 py-2 text-right">
                          {r.pays ? <span className="font-semibold text-foreground">{money(r.pays.price)}</span> : <span className="text-[12px]">no price - hidden</span>}
                          {diff ? <div className={cn("text-[11px]", diff < 0 ? "text-emerald-700" : "text-amber-700")}>{diff < 0 ? "−" : "+"}₹{Math.abs(diff)} vs channel</div> : null}
                        </td>
                        <td className="px-2 py-2">{r.pays ? <SourceBadge source={r.pays.source} list={r.pays.list} /> : null}</td>
                        <td className="px-2 py-2 text-right"><Margin pct={marginPct(r.pays?.price, p.mrp)} /></td>
                        <td className="num px-4 py-2 text-right text-[13px]">{r.pack === null ? <span className="text-tertiary-foreground">—</span> : money(r.pack, 4)}</td>
                      </tr>
                    </SheetRow>
                  );
                })}
                {rows.length === 0 ? <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">No SKUs match.</td></tr> : null}
              </tbody>
            </table>
          </div>
          <div className="border-t border-border bg-muted/30 px-4 py-2 text-[12px] text-tertiary-foreground">
            Price order the app uses: the customer&apos;s party list, else their channel price, else the product&apos;s base DP. SKUs with no price are hidden from them in the app.
          </div>
        </Panel>
      </div>
    </div>
  );
}

function SheetRow({ category, children }: { category: string | null; children: React.ReactNode }) {
  return (
    <>
      {category ? (
        <tr className="border-t border-border bg-muted/30">
          <td colSpan={7} className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-tertiary-foreground">{category}</td>
        </tr>
      ) : null}
      {children}
    </>
  );
}
