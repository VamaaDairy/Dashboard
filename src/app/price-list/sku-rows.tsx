"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight, ExternalLink, Package } from "lucide-react";
import { ProductThumb } from "@/components/products/Product";
import { Margin, money } from "@/components/pricing/PricingTabs";
import type { PackCost } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { PriceCell } from "./editors";

export interface SkuRow {
  uid: string;
  sku: string;
  name: string;
  packQty: string | null;
  unit: string | null;
  image: string | null;
  category: string;
  mrp: number;
  rt: number | null;
  db: number | null;
  rtMargin: number | null;
  dbMargin: number | null;
  inApp: boolean;
  inShop: boolean;
  lists: number;
  pack: PackCost | null;
}

const COLS = 8;

/**
 * The SKU price table: one row per product with its packaging cost, MRP and trade prices (click a price to
 * change it); the arrow opens the packaging subsection - each packing material, how much goes into one piece, at what rate.
 */
export function SkuRows({ rows, canEdit }: { rows: SkuRow[]; canEdit: boolean }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (uid: string) => setOpen((s) => { const n = new Set(s); if (n.has(uid)) n.delete(uid); else n.add(uid); return n; });
  const allOpen = rows.length > 0 && rows.every((r) => open.has(r.uid));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-muted text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="w-9 px-2 py-2.5">
              <button type="button" onClick={() => setOpen(allOpen ? new Set() : new Set(rows.map((r) => r.uid)))} title={allOpen ? "Close all packaging" : "Open all packaging"} aria-label={allOpen ? "Close all packaging" : "Open all packaging"} className="rounded p-0.5 hover:bg-background">
                <ChevronRight className={cn("size-4 transition-transform", allOpen && "rotate-90")} />
              </button>
            </th>
            <th className="px-2 py-2.5">Product</th>
            <th className="px-2 py-2.5 text-right">Packaging / pc</th>
            <th className="px-2 py-2.5 text-right">MRP</th>
            <th className="px-2 py-2.5 text-right">Retailer</th>
            <th className="px-2 py-2.5 text-right">Distributor</th>
            <th className="px-2 py-2.5 text-right">Party lists</th>
            <th className="px-3 py-2.5 text-right" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const isOpen = open.has(r.uid);
            const newCat = i === 0 || rows[i - 1].category !== r.category;
            return (
              <Fragment key={r.uid}>
                {newCat ? (
                  <tr className="border-t border-border bg-muted/40">
                    <td colSpan={COLS} className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-tertiary-foreground">
                      {r.category} <span className="font-normal normal-case">· {rows.filter((x) => x.category === r.category).length} SKUs</span>
                    </td>
                  </tr>
                ) : null}
                <tr className={cn("border-t border-border hover:bg-muted/30", isOpen && "bg-muted/20")}>
                  <td className="px-2 py-2 align-middle">
                    <button type="button" onClick={() => toggle(r.uid)} aria-expanded={isOpen} aria-label={`${isOpen ? "Hide" : "Show"} packaging of ${r.name}`} className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                      <ChevronRight className={cn("size-4 transition-transform", isOpen && "rotate-90")} />
                    </button>
                  </td>
                  <td className="min-w-72 px-2 py-2">
                    <div className="flex items-center gap-2.5">
                      <ProductThumb image={r.image} size={36} />
                      <div className="min-w-0">
                        <Link href={`/price-list/sku/${r.uid}`} className="font-medium text-foreground hover:underline">{r.name}</Link>
                        <div className="flex flex-wrap items-center gap-1 text-[11px] text-tertiary-foreground">
                          <span className="font-mono">{r.sku}</span>
                          <span className="num rounded bg-muted px-1.5 text-muted-foreground" title="Pack quantity">{r.packQty ?? "—"}</span>
                          <span className="rounded bg-muted px-1.5 text-muted-foreground" title="Unit">{r.unit ?? "—"}</span>
                          {!r.inApp ? <span>· no MRP, not in the apps</span> : !r.inShop ? <span>· trade only</span> : null}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="num px-2 py-2 text-right">
                    {r.pack?.perPc != null ? (
                      <button type="button" onClick={() => toggle(r.uid)} className="rounded px-1 hover:bg-muted" title="Show the packing materials">
                        {money(r.pack.perPc)}
                        {r.pack.missingRate ? <AlertTriangle className="ml-1 inline size-3.5 text-amber-600" aria-label="A material has no rate" /> : null}
                        <div className="text-[11px] text-tertiary-foreground">{r.mrp > 0 ? `${Math.round((r.pack.perPc / r.mrp) * 1000) / 10}% of MRP` : ""}</div>
                      </button>
                    ) : <span className="text-[12px] text-tertiary-foreground">not set</span>}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <PriceCell target={{ kind: "mrp" }} productUid={r.uid} value={r.mrp || null} canEdit={canEdit} />
                  </td>
                  <td className="px-2 py-2 text-right">
                    <PriceCell target={{ kind: "channel", channel: "RT" }} productUid={r.uid} value={r.rt} canEdit={canEdit} />
                    <div className="pr-2"><Margin pct={r.rtMargin} /></div>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <PriceCell target={{ kind: "channel", channel: "DB" }} productUid={r.uid} value={r.db} canEdit={canEdit} />
                    <div className="pr-2"><Margin pct={r.dbMargin} /></div>
                  </td>
                  <td className="num px-2 py-2 text-right text-[13px]">
                    {r.lists ? <Link href={`/price-list/sku/${r.uid}#lists`} className="hover:underline">{r.lists}</Link> : <span className="text-tertiary-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link href={`/price-list/sku/${r.uid}`} title="Open the SKU's price card" className="inline-flex rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                      <ExternalLink className="size-4" />
                    </Link>
                  </td>
                </tr>
                {isOpen ? (
                  <tr className="bg-muted/20">
                    <td />
                    <td colSpan={COLS - 1} className="px-2 pb-3 pt-0">
                      <PackBreakdown pack={r.pack} mrp={r.mrp} db={r.db} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
          {rows.length === 0 ? <tr><td colSpan={COLS} className="px-4 py-12 text-center text-muted-foreground">No products match.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

/** The packaging subsection of a SKU: its packing materials per piece, the total, and its share of the prices. */
export function PackBreakdown({ pack, mrp, db }: { pack: PackCost | null; mrp: number; db: number | null }) {
  if (!pack) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-dashed border-border bg-card px-3 py-2.5 text-[12px] text-tertiary-foreground">
        <Package className="size-4" /> No packing list for this SKU in the plant yet - add one on the SKU packing page (Plant &amp; Production).
      </div>
    );
  }
  const share = (base: number | null) => (base && pack.perPc ? `${Math.round((pack.perPc / base) * 1000) / 10}%` : "—");
  return (
    <div className="overflow-hidden rounded-md border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2 text-[12px]">
        <span className="font-semibold text-foreground"><Package className="mr-1 inline size-3.5" />Packaging cost · plant SKU <span className="font-mono">{pack.skuCode}</span> {pack.skuName}</span>
        <span className="text-tertiary-foreground">{pack.pcsPerCase} pcs per case</span>
      </div>
      {pack.flat ? (
        <div className="px-3 py-2.5 text-[13px]">Costed at a flat <span className="num font-semibold">{money(pack.perPc)}</span> per piece (no material list).</div>
      ) : (
        <table className="w-full text-[13px]">
          <thead className="text-left text-[11px] text-tertiary-foreground">
            <tr>
              <th className="px-3 py-1.5 font-medium">Material</th>
              <th className="px-3 py-1.5 text-right font-medium">Quantity</th>
              <th className="px-3 py-1.5 text-right font-medium">Rate</th>
              <th className="px-3 py-1.5 text-right font-medium">Per piece</th>
            </tr>
          </thead>
          <tbody>
            {pack.lines.map((l, i) => (
              <tr key={i} className="border-t border-border/70">
                <td className="px-3 py-1.5">{l.name}</td>
                <td className="num px-3 py-1.5 text-right">{+l.qty.toFixed(4)} {l.unit} / {l.per === "case" ? "case" : "pc"}</td>
                <td className="num px-3 py-1.5 text-right">{l.rate === null ? <span className="text-amber-700">no rate</span> : `${money(l.rate, 4)} / ${l.unit === "kg" ? "kg" : "pc"}`}</td>
                <td className="num px-3 py-1.5 text-right">{money(Math.round(l.perPc * 10000) / 10000, 4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-1 border-t border-border bg-muted/40 px-3 py-2 text-[12px]">
        <span>Total <span className="num ml-1 text-[13px] font-semibold text-foreground">{money(pack.perPc, 4)}</span> / pc</span>
        <span className="text-tertiary-foreground">{share(mrp)} of MRP</span>
        <span className="text-tertiary-foreground">{share(db)} of distributor price</span>
        {pack.missingRate ? <span className="text-amber-700">Some materials have no rate - total is short</span> : null}
      </div>
    </div>
  );
}
