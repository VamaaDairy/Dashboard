import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AlertTriangle, Package, Search, Tags, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, StatCard } from "@/components/cn/ui";
import { PricingTabs } from "@/components/pricing/PricingTabs";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { allListPrices, standardPrices } from "@/lib/price-list";
import { marginPct, packCosts, packFor } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { SkuRows, type SkuRow } from "./sku-rows";

export const dynamic = "force-dynamic";

type Show = "all" | "missing" | "nopack";
const SHOW: Array<[Show, string]> = [["all", "All SKUs"], ["missing", "Missing a trade price"], ["nopack", "No packaging cost"]];

/**
 * SKU prices: the standard price of every product - MRP (what the D2C app sells at), the retailer and distributor
 * prices with the margin each leaves - and its packaging cost per piece, opened as a subsection under the SKU.
 * Party price lists override the trade prices for the customers on them (Party price lists tab).
 */
export default async function SkuPricesPage({ searchParams }: { searchParams: Promise<{ list?: string; q?: string; cat?: string; show?: string }> }) {
  const sp = await searchParams;
  // the party lists used to open here
  if (sp.list) redirect(`/price-list/lists?list=${encodeURIComponent(sp.list)}`);
  const q = sp.q?.trim() ?? "";
  const show: Show = SHOW.some(([k]) => k === sp.show) ? (sp.show as Show) : "all";

  const me = await userFromToken((await cookies()).get("session")?.value);
  const canEdit = !!me && atLeast(levelFor(me, "pricelist"), "edit");
  const [products, costs, listPrices] = await Promise.all([standardPrices(), packCosts(), allListPrices()]);

  const all: SkuRow[] = products.map((p) => ({
    ...p,
    rtMargin: marginPct(p.rt, p.mrp),
    dbMargin: marginPct(p.db, p.mrp),
    lists: listPrices.get(p.uid)?.size ?? 0,
    pack: packFor(costs, p.sku),
  }));
  const cats = [...new Set(all.map((r) => r.category))];
  const rows = all.filter((r) =>
    (!sp.cat || r.category === sp.cat) &&
    (!q || `${r.sku} ${r.name} ${r.category}`.toLowerCase().includes(q.toLowerCase())) &&
    (show === "all" || (show === "missing" ? r.inApp && (!r.rt || !r.db) : r.pack?.perPc == null)),
  );

  const inApp = all.filter((r) => r.inApp);
  const missing = inApp.filter((r) => !r.rt || !r.db).length;
  const noPack = all.filter((r) => r.pack?.perPc == null).length;
  const margins = inApp.map((r) => r.dbMargin).filter((m): m is number => m !== null);
  const avgDb = margins.length ? Math.round((margins.reduce((a, b) => a + b, 0) / margins.length) * 10) / 10 : null;

  const link = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: q || undefined, cat: sp.cat, show: show === "all" ? undefined : show, ...patch })) if (v) p.set(k, v);
    return p.size ? `/price-list?${p}` : "/price-list";
  };
  const chip = (on: boolean) => cn("rounded-full border px-2.5 py-1 text-[12px]", on ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted");

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <PageHeader icon={Tags} title="SKU prices" subtitle="Standard price of every SKU: MRP, retailer and distributor price with margins, and the packaging cost per piece." />
        <PricingTabs on="skus" />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={Tags} label="SKUs in the apps" value={inApp.length.toLocaleString("en-IN")} note={`${all.length - inApp.length} without MRP`} />
          <StatCard icon={AlertTriangle} label="Missing a trade price" value={String(missing)} tone={missing ? "warning" : "success"} note="retailer or distributor price empty" href={link({ show: "missing" })} />
          <StatCard icon={Package} label="No packaging cost" value={String(noPack)} tone={noPack ? "warning" : "success"} note="no packing list in the plant" href={link({ show: "nopack" })} />
          <StatCard icon={TrendingUp} label="Avg distributor margin" value={avgDb === null ? "—" : `${avgDb}%`} tone="brand" note="below MRP, across SKUs" />
        </div>

        <Panel flush>
          <div className="flex flex-col gap-3 border-b border-border p-3 lg:flex-row lg:flex-wrap lg:items-center">
            <form action="/price-list" className="relative lg:w-72">
              {sp.cat ? <input type="hidden" name="cat" value={sp.cat} /> : null}
              {show !== "all" ? <input type="hidden" name="show" value={show} /> : null}
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <input name="q" defaultValue={q} placeholder="Search SKU, name or category" className="h-9 w-full rounded-lg border border-input bg-background pr-3 pl-8 text-sm outline-none focus:border-foreground" />
            </form>
            <div className="flex flex-wrap gap-1.5">
              {SHOW.map(([k, l]) => <Link key={k} href={link({ show: k === "all" ? undefined : k })} className={chip(show === k)}>{l}</Link>)}
            </div>
            <div className="flex flex-wrap gap-1.5 lg:ml-auto">
              <Link href={link({ cat: undefined })} className={chip(!sp.cat)}>All categories</Link>
              {cats.map((c) => <Link key={c} href={link({ cat: c })} className={chip(sp.cat === c)}>{c}</Link>)}
            </div>
          </div>
          <SkuRows rows={rows} canEdit={canEdit} />
          <div className="border-t border-border bg-muted/30 px-4 py-2 text-[12px] text-tertiary-foreground">
            {rows.length} of {all.length} SKUs · click a price to change it · margins are % below MRP · packaging comes from each SKU&apos;s packing list in the plant at today&apos;s material rates.
          </div>
        </Panel>
      </div>
    </div>
  );
}
