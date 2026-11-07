import Link from "next/link";
import { Tags } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ProductCell } from "@/components/products/Product";
import { nameCheck } from "@/lib/products/names-check";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** One name per SKU: what every list calls each SKU number, and where they don't agree. */
export default async function ProductNamesPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const all = (await searchParams).all === "1";
  const rows = await nameCheck();
  const clashes = rows.filter((r) => r.clashes.length).length;
  const missing = rows.filter((r) => !r.inMaster).length;
  const shown = all ? rows : rows.filter((r) => r.clashes.length || !r.inMaster);
  const chip = (on: boolean) => cn("rounded-full border px-3 py-1 text-sm", on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted");
  const other = (name: string | null, clash: boolean) =>
    name ? <span className={cn(clash && "font-semibold text-red-600")}>{name}</span> : <span className="text-muted-foreground/50">—</span>;

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-4">
        <PageHeader
          icon={Tags}
          title="Product names"
          subtitle="Every screen and report shows one name per SKU: the Gaia D2C app's name from the Product Master, with pack qty and unit apart. This page shows where another list uses the same SKU number for a different product."
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border p-3"><div className="text-xs text-muted-foreground">SKU numbers in use</div><div className="num text-2xl font-semibold">{rows.length}</div></div>
          <div className={cn("rounded-lg border p-3", clashes ? "border-red-500/40 bg-red-500/5" : "border-border")}><div className="text-xs text-muted-foreground">SKU clashes (fix the list&apos;s code)</div><div className="num text-2xl font-semibold">{clashes}</div></div>
          <div className={cn("rounded-lg border p-3", missing ? "border-amber-500/40 bg-amber-500/5" : "border-border")}><div className="text-xs text-muted-foreground">Not in the Product Master</div><div className="num text-2xl font-semibold">{missing}</div></div>
        </div>
        <div className="flex gap-1.5">
          <Link href="/product-names" className={chip(!all)}>Problems only</Link>
          <Link href="/product-names?all=1" className={chip(all)}>Every SKU</Link>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>{["Product (one name)", "Pack qty", "Unit", "Production SKU list", "Route orders list", "WhatsApp catalog", "Status"].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.skuNo} className="border-t border-border align-top hover:bg-muted/40">
                  <td className="min-w-64 px-3 py-2"><ProductCell p={{ ...r.label, clash: undefined }} /></td>
                  <td className="num whitespace-nowrap px-3 py-2">{r.label.qty ?? "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2">{r.label.unit ?? "—"}</td>
                  <td className="min-w-48 px-3 py-2">{other(r.production, r.clashes.includes("Production SKU list"))}</td>
                  <td className="min-w-48 px-3 py-2">{other(r.route, r.clashes.includes("Route orders list"))}</td>
                  <td className="min-w-48 px-3 py-2">{other(r.whatsapp, r.clashes.includes("WhatsApp catalog"))}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs font-semibold">
                    {r.clashes.length ? <span className="text-red-600">Clash: {r.clashes.join(", ")}</span>
                      : !r.inMaster ? <span className="text-amber-600">Not in Product Master</span>
                      : <span className="text-emerald-600">OK</span>}
                  </td>
                </tr>
              ))}
              {shown.length === 0 ? <tr><td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">Every list agrees with the Product Master.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
