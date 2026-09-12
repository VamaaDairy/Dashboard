import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/format";
import { getClasses, getGrid, getLastCalc, getScenario } from "@/lib/data";

export const dynamic = "force-dynamic";

const SNAPSHOT_FIELDS = [
  { key: "material_cost", label: "Material" },
  { key: "packing_cost", label: "Packing" },
  { key: "ex_plant_cost", label: "Ex-plant" },
  { key: "market_transport", label: "Transport" },
  { key: "landed_cost", label: "Landed" },
  { key: "selling_price", label: "Selling" },
];

export default async function OverviewPage() {
  const [scenario, classes, calc, products] = await Promise.all([
    getScenario(),
    getClasses(),
    getLastCalc(),
    getGrid("product"),
  ]);

  const errors = (products?.rows ?? []).flatMap((r) =>
    Object.entries(r.cells)
      .filter(([, c]) => c.error)
      .map(([k, c]) => ({ ref: `${r.code}.${k}`, error: c.error as string })),
  );

  return (
    <div className="flex flex-col flex-1 bg-white p-4 md:p-6 min-h-screen">
      <div className="w-full space-y-5">
        <PageHeader
          icon={LayoutGrid}
          title={scenario?.name ?? "Costing"}
          subtitle={scenario?.description}
          actions={
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline" className="border-blue-200 bg-blue-50/60 text-[#2B4C86] font-mono font-bold text-xs">
                Effective {scenario?.effective_from?.toString().slice(0, 10)}
              </Badge>
              <Badge variant="outline" className="border-blue-200 bg-blue-50/60 text-[#2B4C86] font-mono font-bold text-xs uppercase">
                {scenario?.status}
              </Badge>
            </div>
          }
        />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {classes.map((c) => (
            <Link
              key={c.id}
              href={`/c/${c.code}`}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm transition-colors hover:border-[#4A6FA5]"
            >
              <div className="num text-[24px] font-black text-[#3E5FA0]">{c.object_count}</div>
              <div className="text-[12px] font-medium text-slate-500">{c.plural_name ?? c.name}</div>
            </Link>
          ))}
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <div className="num text-[24px] font-black text-[#3E9B4F]">{calc?.node_count ?? 0}</div>
            <div className="text-[12px] font-medium text-slate-500">
              calculated values · {calc?.duration_ms ?? 0} ms
            </div>
          </div>
        </div>

        {errors.length ? (
          <section className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
            <h2 className="font-bold text-red-600">{errors.length} formula error(s)</h2>
            <ul className="mt-1 font-mono text-[11px] text-red-600">
              {errors.slice(0, 10).map((e) => (
                <li key={e.ref}>{e.ref}: {e.error}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {products ? (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h2 className="font-bold text-slate-700">Product cost snapshot</h2>
              <Link href="/c/product" className="text-[12px] font-semibold text-[#2B4C86] hover:underline">
                Open full sheet →
              </Link>
            </div>
            <div className="overflow-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-[#F8FAFD] text-[10px] uppercase tracking-wider text-[#2B4C86]">
                    <th className="px-4 py-2 text-left font-bold">Product</th>
                    {SNAPSHOT_FIELDS.map((f) => (
                      <th key={f.key} className="px-3 py-2 text-right font-bold">{f.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {products.rows.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100 hover:bg-blue-50/40">
                      <td className="px-4 py-1.5">
                        <Link href={`/c/product/${r.code}`} className="hover:text-[#2B4C86] hover:underline">
                          {r.name}
                        </Link>
                      </td>
                      {SNAPSHOT_FIELDS.map((f) => (
                        <td key={f.key} className="num px-3 py-1.5 text-right">
                          {formatNumber(r.cells[f.key]?.computed_num ?? null, 2)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
