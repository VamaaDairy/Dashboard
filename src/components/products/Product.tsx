import { Package } from "lucide-react";
import type { ProductLabel } from "@/lib/products/names";

/**
 * How a product looks everywhere in the dashboard: photo, SKU code, the one product name (as the Gaia D2C app
 * names it), and the pack quantity and unit kept apart from the name. See src/lib/products/names.ts.
 */

export function ProductThumb({ image, size = 32 }: { image: string | null; size?: number }) {
  if (!image) {
    return (
      <span style={{ width: size, height: size }} className="inline-flex shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
        <Package className="h-1/2 w-1/2" />
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- small thumbnails of stored product photos
  return <img src={image} alt="" loading="lazy" style={{ width: size, height: size }} className="shrink-0 rounded-md border border-border object-cover" />;
}

/** Photo + SKU + name, for a table's Product column (put Qty and Unit in their own columns with `PackQty`/`PackUnit`). */
export function ProductCell({ p, size = 32 }: { p: ProductLabel; size?: number }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <ProductThumb image={p.image} size={size} />
      <span className="min-w-0">
        <span className="block font-mono text-[11px] text-muted-foreground">{p.sku || "—"}</span>
        <span className="block font-medium leading-tight">{p.name}</span>
        {p.clash ? (
          <span className="block text-[10px] font-semibold text-red-600" title="This list's SKU code is a different product in the Product Master">
            SKU clash: master says {p.clash}
          </span>
        ) : !p.inMaster ? <span className="block text-[10px] font-semibold uppercase text-amber-600">Not in Product Master</span> : null}
      </span>
    </span>
  );
}

export const PackQty = ({ p }: { p: ProductLabel }) => <span className="num whitespace-nowrap">{p.qty ?? "—"}</span>;
export const PackUnit = ({ p }: { p: ProductLabel }) => <span className="whitespace-nowrap">{p.unit ?? "—"}</span>;

/** Pack qty and unit side by side, as two chips (where a table has one column for both). */
export function QtyUnit({ p }: { p: ProductLabel }) {
  if (!p.qty && !p.unit) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex gap-1">
      <span title="Pack quantity" className="num whitespace-nowrap rounded bg-muted px-1.5 text-[11px]">{p.qty ?? "—"}</span>
      <span title="Unit" className="whitespace-nowrap rounded bg-muted px-1.5 text-[11px]">{p.unit ?? "—"}</span>
    </span>
  );
}

/**
 * One product on one line, where there's no room for columns (order item lists, cards):
 * [photo] 1042 Gaia Maxx UHT [110] [ml] × 3
 */
export function ProductLine({ p, count, after }: { p: ProductLabel; count?: number | string; after?: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2 py-0.5">
      <ProductThumb image={p.image} size={24} />
      <span className="font-mono text-[11px] text-muted-foreground">{p.sku}</span>
      <span className="font-medium">{p.name}</span>
      {p.qty ? <span title="Pack quantity" className="num whitespace-nowrap rounded bg-muted px-1.5 text-[11px] text-muted-foreground">{p.qty}</span> : null}
      {p.unit ? <span title="Unit" className="whitespace-nowrap rounded bg-muted px-1.5 text-[11px] text-muted-foreground">{p.unit}</span> : null}
      {p.clash ? <span className="text-[10px] font-semibold text-red-600" title={`Product Master says ${p.clash}`}>SKU clash</span> : null}
      {count !== undefined ? <span className="num whitespace-nowrap">× {count}</span> : null}
      {after}
    </span>
  );
}
