import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { ArrowLeft, History, ListChecks, Package, Tags } from "lucide-react";
import { ProductThumb } from "@/components/products/Product";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, Pill } from "@/components/cn/ui";
import { Margin, PricingTabs, money } from "@/components/pricing/PricingTabs";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { marginPct, skuCard } from "@/lib/pricing";
import { PriceCell } from "../../editors";
import { PackBreakdown } from "../../sku-rows";

export const dynamic = "force-dynamic";

const when = (d: Date) =>
  new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** One SKU's price card: every price it has (MRP, each channel, each party list), its packaging cost and its price history. */
export default async function SkuPricePage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  const card = await skuCard(uid);
  if (!card) notFound();
  const me = await userFromToken((await cookies()).get("session")?.value);
  const canEdit = !!me && atLeast(levelFor(me, "pricelist"), "edit");
  const { product: p, pack } = card;

  // the price ladder, MRP down to packaging, each as a share of MRP
  const ladder = [
    { label: "MRP (D2C app)", value: p.mrp, tone: "bg-primary" },
    { label: "Retailer price", value: p.rt, tone: "bg-sky-500" },
    { label: "Distributor price", value: p.db, tone: "bg-emerald-500" },
    { label: "Packaging cost", value: pack?.perPc ?? null, tone: "bg-pink-400" },
  ];
  const listed = card.lists.filter((l) => l.price !== null);

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <PageHeader
          icon={Tags}
          title="SKU price card"
          subtitle="Every price this SKU has, its packaging cost and every change made to its prices."
          actions={<Link href="/price-list" className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> SKU prices</Link>}
        />
        <PricingTabs on="skus" />

        <section className="flex flex-col gap-5 rounded-lg border border-border bg-card p-4 shadow-xs md:flex-row md:items-center">
          <div className="flex min-w-0 items-center gap-4 md:w-96">
            <ProductThumb image={p.image} size={72} />
            <div className="min-w-0">
              <h2 className="text-lg font-semibold leading-tight text-foreground">{p.name}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-tertiary-foreground">
                <span className="font-mono">{p.sku}</span>
                <span className="num rounded bg-muted px-1.5 text-muted-foreground" title="Pack quantity">{p.packQty ?? "—"}</span>
                <span className="rounded bg-muted px-1.5 text-muted-foreground" title="Unit">{p.unit ?? "—"}</span>
                <span>· {p.category}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {p.inApp ? <Pill tone="success">In the apps</Pill> : <Pill tone="warning">No MRP - not in the apps</Pill>}
                {p.inApp && !p.inShop ? <Pill>Trade only</Pill> : null}
              </div>
            </div>
          </div>
          <div className="flex-1 space-y-2">
            {ladder.map((l) => (
              <div key={l.label} className="grid grid-cols-[8.5rem_minmax(0,1fr)_6rem] items-center gap-3 text-[13px]">
                <span className="text-tertiary-foreground">{l.label}</span>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                  {l.value && p.mrp ? <div className={`h-full rounded-full ${l.tone}`} style={{ width: `${Math.min(100, (l.value / p.mrp) * 100)}%` }} /> : null}
                </div>
                <span className="num text-right font-semibold">{money(l.value)}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="grid items-start gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <Panel title="Standard prices" description="MRP is what the D2C app sells at. Retailer and distributor prices apply to every customer not on a party list." flush>
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-border">
                    <td className="px-4 py-2.5 font-medium">MRP</td>
                    <td className="px-2 py-2.5 text-right"><PriceCell target={{ kind: "mrp" }} productUid={p.uid} value={p.mrp || null} canEdit={canEdit} /></td>
                    <td className="w-20 px-4 py-2.5" />
                  </tr>
                  <tr className="border-b border-border">
                    <td className="px-4 py-2.5 font-medium">Retailer</td>
                    <td className="px-2 py-2.5 text-right"><PriceCell target={{ kind: "channel", channel: "RT" }} productUid={p.uid} value={p.rt} canEdit={canEdit} /></td>
                    <td className="px-4 py-2.5 text-right"><Margin pct={marginPct(p.rt, p.mrp)} /></td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-medium">Distributor</td>
                    <td className="px-2 py-2.5 text-right"><PriceCell target={{ kind: "channel", channel: "DB" }} productUid={p.uid} value={p.db} canEdit={canEdit} /></td>
                    <td className="px-4 py-2.5 text-right"><Margin pct={marginPct(p.db, p.mrp)} /></td>
                  </tr>
                </tbody>
              </table>
            </Panel>

            <Panel title="Every channel" description="Rates set per channel in the portal (all states)." flush>
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <tr><th className="px-4 py-2">Channel</th><th className="px-2 py-2 text-right">Price</th><th className="px-4 py-2 text-right">Margin</th></tr>
                </thead>
                <tbody>
                  {card.channels.map((c) => (
                    <tr key={c.uid} className="border-t border-border">
                      <td className="px-4 py-2">{c.name} <span className="font-mono text-[11px] text-tertiary-foreground">{c.code}</span></td>
                      <td className="num px-2 py-2 text-right">{c.price ? money(c.price) : <span className="text-tertiary-foreground">—</span>}</td>
                      <td className="px-4 py-2 text-right"><Margin pct={marginPct(c.price, p.mrp)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>

            <div id="lists" className="scroll-mt-4">
              <Panel
                title={<span className="inline-flex items-center gap-1.5"><ListChecks className="size-4" /> Party price lists ({listed.length} of {card.lists.length})</span>}
                description="Lists that give this SKU a special price. Change a price on the list itself."
                flush
              >
                <table className="w-full text-sm">
                  <thead className="bg-muted/60 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <tr><th className="px-4 py-2">List</th><th className="px-2 py-2 text-right">Customers</th><th className="px-2 py-2 text-right">Price</th><th className="px-4 py-2 text-right">vs distributor</th></tr>
                  </thead>
                  <tbody>
                    {listed.map((l) => {
                      const diff = l.price !== null && p.db ? Math.round((l.price - p.db) * 100) / 100 : null;
                      return (
                        <tr key={l.uid} className="border-t border-border">
                          <td className="px-4 py-2">
                            <Link href={`/price-list/lists?list=${l.uid}`} className="font-medium hover:underline">{l.name}</Link>
                            {l.grp ? <span className="ml-1.5 text-[11px] text-tertiary-foreground">{l.grp}</span> : null}
                          </td>
                          <td className="num px-2 py-2 text-right">{l.customers}</td>
                          <td className="num px-2 py-2 text-right font-semibold">{money(l.price)} <Margin pct={marginPct(l.price, p.mrp)} className="ml-1" /></td>
                          <td className="num px-4 py-2 text-right text-[12px]">
                            {diff === null ? "—" : <span className={diff < 0 ? "text-emerald-700" : diff > 0 ? "text-amber-700" : "text-tertiary-foreground"}>{diff === 0 ? "same" : `${diff < 0 ? "−" : "+"}₹${Math.abs(diff)}`}</span>}
                          </td>
                        </tr>
                      );
                    })}
                    {listed.length === 0 ? <tr><td colSpan={4} className="px-4 py-6 text-center text-[13px] text-tertiary-foreground">No party list prices this SKU - everyone pays their channel price.</td></tr> : null}
                  </tbody>
                </table>
              </Panel>
            </div>
          </div>

          <div className="space-y-4">
            <Panel title={<span className="inline-flex items-center gap-1.5"><Package className="size-4" /> Packaging</span>} description="From the SKU's packing list in the plant, at the current packing-material rates (incl. GST and freight)." flush>
              <div className="p-3"><PackBreakdown pack={pack} mrp={p.mrp} db={p.db} /></div>
            </Panel>

            <Panel title={<span className="inline-flex items-center gap-1.5"><History className="size-4" /> Price history</span>} description="Every change to this SKU's prices, newest first." flush>
              <ul className="max-h-[28rem] divide-y divide-border overflow-y-auto text-[13px]">
                {card.history.map((h, i) => (
                  <li key={i} className="px-4 py-2.5">
                    <div className="text-foreground">{h.summary}</div>
                    <div className="text-[11px] text-tertiary-foreground">{when(h.at)} · {h.actor}</div>
                  </li>
                ))}
                {card.history.length === 0 ? <li className="px-4 py-6 text-center text-tertiary-foreground">No price changes recorded yet.</li> : null}
              </ul>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
