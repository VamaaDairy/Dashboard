import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { MasterList, Thumb, type MasterItem } from "@/components/pricing/MasterList";
import { DetailHeading, Margin, NothingPicked, PACK_COLOR, SUB, Split, Summary, T, money, money2 } from "@/components/pricing/ui";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { allListPrices, priceLists, standardPrices } from "@/lib/price-list";
import { marginPct, packCosts, packFor, skuCard, type PackCost, type SkuCard } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { PriceCell } from "./editors";

export const dynamic = "force-dynamic";

const initials = (name: string) => name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w) && !/^gaia$/i.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
const when = (d: Date) => new Date(d).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });

/**
 * SKUs: every product on the left; the one picked on the right with its MRP and trade prices (click to change),
 * where they sit against each other, its packaging cost from the plant's packing list, the party lists that price it
 * and its price history.
 */
export default async function SkuPricesPage({ searchParams }: { searchParams: Promise<{ sku?: string; list?: string }> }) {
  const sp = await searchParams;
  // party lists used to open here
  if (sp.list) redirect(`/price-list/lists?list=${encodeURIComponent(sp.list)}`);
  const me = await userFromToken((await cookies()).get("session")?.value);
  const canEdit = !!me && atLeast(levelFor(me, "pricelist"), "edit");

  const [products, costs, , lists] = await Promise.all([standardPrices(), packCosts(), allListPrices(), priceLists()]);
  const onSale = products.filter((p) => p.inApp);
  const missing = onSale.filter((p) => !p.rt || !p.db).length;
  const margins = onSale.map((p) => marginPct(p.db, p.mrp)).filter((m): m is number => m !== null);
  const avg = margins.length ? Math.round((margins.reduce((a, b) => a + b, 0) / margins.length) * 10) / 10 : null;
  const noPack = products.filter((p) => packFor(costs, p.sku)?.perPc == null).length;

  const selected = products.find((p) => p.uid === sp.sku)?.uid ?? onSale[0]?.uid ?? products[0]?.uid ?? null;
  const card = selected ? await skuCard(selected) : null;

  const items: MasterItem[] = products.map((p) => ({
    id: p.uid,
    href: `/price-list?sku=${p.uid}`,
    group: p.category,
    title: p.name,
    sub: [p.sku, [p.packQty, p.unit].filter(Boolean).join(" ")].filter(Boolean).join(" · "),
    right: p.mrp ? money(p.mrp) : "No MRP",
    rightSub: p.db ? money(p.db) : "—",
    image: p.image,
    initials: initials(p.name),
    flag: p.inApp && (!p.rt || !p.db) ? `No ${!p.rt && !p.db ? "trade" : !p.rt ? "retailer" : "distributor"} price` : null,
    keywords: p.category,
  }));
  const cats = [...new Set(products.map((p) => p.category))];

  return (
    <>
      <Summary items={[
        { value: String(onSale.length), label: "SKUs on sale" },
        { value: String(missing), label: "missing a trade price", alert: missing > 0 },
        { value: avg === null ? "—" : `${avg}%`, label: "average distributor margin" },
        { value: String(products.length - noPack), label: `with packaging cost (${noPack} without)` },
        { value: String(lists.length), label: "party price lists", href: "/price-list/lists" },
      ]} />
      <Split
        list={
          <MasterList
            items={items}
            selected={selected}
            placeholder="Search SKU or name"
            filters={{ label: "Category", value: "", options: [{ value: "", label: "All categories" }, ...cats.map((c) => ({ value: c, label: c }))] }}
            footer="Right column: MRP over distributor price"
          />
        }
      >
        {card ? <SkuDetail card={card} canEdit={canEdit} /> : <NothingPicked>No products yet.</NothingPicked>}
      </Split>
    </>
  );
}

function SkuDetail({ card, canEdit }: { card: SkuCard; canEdit: boolean }) {
  const { product: p, pack } = card;
  const listed = card.lists.filter((l) => l.price !== null);
  const others = card.channels.filter((c) => c.price && c.code !== "DB" && c.code !== "RT");

  return (
    <div className="px-6 py-7 xl:px-9">
      <div className="flex items-center gap-4">
        <Thumb image={p.image} initials={initials(p.name)} size={60} />
        <div className="min-w-0">
          <h2 className="truncate text-[20px] font-semibold tracking-tight text-foreground">{p.name}</h2>
          <div className={cn("tabular-nums mt-1 flex flex-wrap gap-x-2.5 text-[13px]", SUB)}>
            <span>SKU {p.sku}</span><span>·</span>
            <span>{[p.packQty, p.unit].filter(Boolean).join(" ") || "no size"}</span><span>·</span>
            <span>{p.category}</span><span>·</span>
            <span>{!p.inApp ? "Not on sale (no MRP)" : p.inShop ? "On sale in all apps" : "Distributors and retailers only"}</span>
          </div>
        </div>
      </div>

      {/* the four numbers */}
      <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-foreground/10 bg-foreground/10 xl:grid-cols-4">
        <Figure label="MRP" note="The D2C app sells at this">
          <PriceCell size="lg" target={{ kind: "mrp" }} productUid={p.uid} value={p.mrp || null} canEdit={canEdit} />
        </Figure>
        <Figure label="Retailer price" note={<Margin pct={marginPct(p.rt, p.mrp)} />}>
          <PriceCell size="lg" target={{ kind: "channel", channel: "RT" }} productUid={p.uid} value={p.rt} canEdit={canEdit} />
        </Figure>
        <Figure label="Distributor price" note={<Margin pct={marginPct(p.db, p.mrp)} />}>
          <PriceCell size="lg" target={{ kind: "channel", channel: "DB" }} productUid={p.uid} value={p.db} canEdit={canEdit} />
        </Figure>
        <Figure label="Packaging" note={pack?.perPc != null && p.mrp ? `${Math.round((pack.perPc / p.mrp) * 1000) / 10}% of MRP` : "No packing list in the plant"}>
          <div className="tabular-nums flex h-10 items-center text-[22px] font-semibold tracking-tight text-foreground">{pack?.perPc != null ? money2(pack.perPc) : "—"}</div>
        </Figure>
      </div>

      {p.mrp > 0 ? <PriceBar mrp={p.mrp} rt={p.rt} db={p.db} pack={pack?.perPc ?? null} /> : null}

      <div className="grid gap-x-12 min-[1700px]:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div>
          <DetailHeading note={pack ? `Plant SKU ${pack.skuCode} · ${pack.pcsPerCase} per case` : undefined}>Packaging</DetailHeading>
          <PackTable pack={pack} />
        </div>
        <div>
          <DetailHeading note={`${listed.length} of ${card.lists.length} price this SKU`}>Party price lists</DetailHeading>
          {listed.length ? (
            <table className={T.table}>
              <thead><tr><th className={T.th}>List</th><th className={cn(T.th, "text-right")}>Customers</th><th className={cn(T.th, "text-right")}>Price</th></tr></thead>
              <tbody>
                {listed.map((l) => {
                  const diff = l.price !== null && p.db ? Math.round((l.price - p.db) * 100) / 100 : null;
                  return (
                    <tr key={l.uid}>
                      <td className={T.td}><Link href={`/price-list/lists?list=${l.uid}`} className="font-medium text-foreground hover:underline">{l.name}</Link></td>
                      <td className={cn(T.td, "tabular-nums text-right", SUB)}>{l.customers}</td>
                      <td className={cn(T.td, "tabular-nums text-right whitespace-nowrap")}>
                        <span className="font-medium text-foreground">{money2(l.price)}</span>
                        {diff ? <span className={cn("ml-2", SUB)}>{diff > 0 ? "+" : "−"}{money2(Math.abs(diff))}</span> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : <p className={cn("py-2 text-[13px]", SUB)}>No party list prices this SKU, so every customer pays their channel price.</p>}

          {others.length ? (
            <>
              <DetailHeading>Other channels</DetailHeading>
              <table className={T.table}>
                <tbody>
                  {others.map((c) => (
                    <tr key={c.uid}>
                      <td className={T.td}>{c.name}</td>
                      <td className={cn(T.td, "tabular-nums text-right")}><span className="font-medium">{money2(c.price)}</span> <Margin pct={marginPct(c.price, p.mrp)} className="ml-2" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}

          <DetailHeading>History</DetailHeading>
          {card.history.length ? (
            <ul className="text-[13px]">
              {card.history.slice(0, 8).map((h, i) => (
                <li key={i} className="border-b border-foreground/10 py-2.5">
                  <div className="text-foreground">{h.summary}</div>
                  <div className={cn("mt-0.5 text-[12px]", SUB)}>{when(h.at)} · {h.actor}</div>
                </li>
              ))}
            </ul>
          ) : <p className={cn("py-2 text-[13px]", SUB)}>No price changes recorded yet.</p>}
        </div>
      </div>
    </div>
  );
}

function Figure({ label, note, children }: { label: string; note?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-card px-5 py-4">
      <div className="text-[12px] font-medium text-foreground/75">{label}</div>
      <div className="mt-1.5">{children}</div>
      <div className="mt-1 min-h-[18px] text-[12px] text-foreground/75">{note}</div>
    </div>
  );
}

/** MRP as a scale: packaging as a filled segment, the trade prices as ticks, labelled below (or above when two are close). */
function PriceBar({ mrp, rt, db, pack }: { mrp: number; rt: number | null; db: number | null; pack: number | null }) {
  const at = (v: number) => Math.max(0, Math.min(100, (v / mrp) * 100));
  const marks = [
    db ? { v: db, label: "distributor" } : null,
    rt ? { v: rt, label: "retailer" } : null,
    { v: mrp, label: "MRP" },
  ].filter((m): m is { v: number; label: string } => !!m);
  // a label too close to the next one goes above the bar
  const above = marks.map((m, i) => i < marks.length - 1 && at(marks[i + 1].v) - at(m.v) < 11);
  return (
    <div className="tabular-nums mt-8 mb-2">
      <div className="relative h-7">
        {marks.map((m, i) => above[i] ? <Label key={m.label} pos={at(m.v)} value={m.v} label={m.label} /> : null)}
      </div>
      <div className="relative h-2.5 rounded-full bg-foreground/[0.07]">
        {pack ? <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.max(1.5, at(pack))}%`, background: PACK_COLOR }} /> : null}
        {marks.map((m) => (
          <div key={m.label} className="absolute -top-1 -bottom-1 w-0.5 rounded bg-foreground" style={{ left: `calc(${at(m.v)}% - ${m.v === mrp ? 2 : 1}px)` }} />
        ))}
      </div>
      <div className="relative mt-2 h-9">
        {pack ? <Label pos={Math.max(4, at(pack) / 2)} value={pack} label="packaging" /> : null}
        {marks.map((m, i) => !above[i] ? <Label key={m.label} pos={at(m.v)} value={m.v} label={m.label} /> : null)}
      </div>
    </div>
  );
}

function Label({ pos, value, label }: { pos: number; value: number; label: string }) {
  const align = pos > 94 ? "-translate-x-full text-right" : pos < 6 ? "text-left" : "-translate-x-1/2 text-center";
  return (
    <span className={cn("absolute top-0 whitespace-nowrap text-[12px] leading-tight", align)} style={{ left: `${pos}%` }}>
      <b className="block font-semibold text-foreground">{money(value)}</b>
      <span className="text-foreground/75">{label}</span>
    </span>
  );
}

const perPiece = (l: PackCost["lines"][number], perCase: number) =>
  l.per === "case" ? `${+l.qty.toFixed(3)} / ${perCase}` : l.unit === "kg" ? `${+(l.qty * 1000).toFixed(2)} g` : `${+l.qty.toFixed(3)}`;

function PackTable({ pack }: { pack: PackCost | null }) {
  if (!pack) return <p className={cn("py-2 text-[13px]", SUB)}>This SKU has no packing list in the plant yet. Add one on the SKU packing page under Plant &amp; Production.</p>;
  if (pack.flat) return <p className="py-2 text-[13px] text-foreground">Costed at a flat <span className="tabular-nums font-semibold">{money2(pack.perPc)}</span> per piece, without a material list.</p>;
  return (
    <table className={cn(T.table, "tabular-nums")}>
      <thead>
        <tr>
          <th className={T.th}>Material</th>
          <th className={cn(T.th, "text-right whitespace-nowrap")}>Per piece</th>
          <th className={cn(T.th, "text-right")}>Rate</th>
          <th className={cn(T.th, "text-right")}>Cost</th>
        </tr>
      </thead>
      <tbody>
        {pack.lines.map((l, i) => (
          <tr key={i}>
            <td className={cn(T.td, "text-foreground")}>{l.name}</td>
            <td className={cn(T.td, "text-right text-foreground")}>{perPiece(l, pack.pcsPerCase)}</td>
            <td className={cn(T.td, "text-right", l.rate === null ? "text-destructive" : SUB)}>{l.rate === null ? "no rate" : `${money(l.rate, 2)}${l.unit === "kg" ? " / kg" : ""}`}</td>
            <td className={cn(T.td, "text-right text-foreground")}>{money(Math.round(l.perPc * 10000) / 10000, 4)}</td>
          </tr>
        ))}
        <tr>
          <td className="pt-3 font-semibold text-foreground" colSpan={3}>Total per piece{pack.missingRate ? <span className="ml-2 font-normal text-destructive">(a material has no rate)</span> : null}</td>
          <td className="pt-3 text-right font-semibold text-foreground">{money(pack.perPc, 4)}</td>
        </tr>
      </tbody>
    </table>
  );
}
