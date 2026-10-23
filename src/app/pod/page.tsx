import { cookies } from "next/headers";
import { PackageCheck, SearchX } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { EmptyState, Panel } from "@/components/cn/ui";
import { GrnForm } from "@/components/grn/GrnForm";
import { DeleteGrn } from "@/components/grn/DeleteGrn";
import { listGrns } from "@/lib/grn/data";
import { thumb } from "@/lib/grn/cloudinary";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { today } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function GrnPage({ searchParams }: PageProps<"/pod">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const me = await userFromToken((await cookies()).get("session")?.value);
  const canEdit = !!me && atLeast(levelFor(me, "grn"), "edit");
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : "";
  const rows = await listGrns(q, date);
  const byDate = new Map<string, typeof rows>();
  for (const r of rows) byDate.set(r.pod_date, [...(byDate.get(r.pod_date) ?? []), r]);
  const fmt = (d: string) => d.split("-").reverse().join("-");

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="mx-auto w-full max-w-5xl space-y-5">
        <PageHeader icon={PackageCheck} title="POD" subtitle="Proof-of-delivery images, date-wise, with the customer and invoice number." />

        {canEdit ? <GrnForm today={today()} /> : null}

        <Panel
          title="Saved PODs"
          flush
          actions={
            <form action="/pod" className="flex items-center gap-2">
              <Input name="date" type="date" defaultValue={date} className="h-8 w-40" aria-label="Filter by date" />
              <Input name="q" defaultValue={q} placeholder="Invoice no. or customer" className="h-8 w-52" />
              <button type="submit" className="sr-only">Search</button>
              {date || q ? <a href="/pod" className="text-[12px] text-tertiary-foreground underline">Clear</a> : null}
            </form>
          }
        >
          {rows.length === 0 ? (
            <EmptyState icon={SearchX} title={q ? "No POD matches that invoice" : "No POD added yet"} />
          ) : (
            <div className="divide-y divide-border">
              {[...byDate].map(([d, items]) => (
                <section key={d} className="p-4">
                  <h3 className="mb-3 text-[13px] font-semibold">
                    {fmt(d)} <span className="font-normal text-tertiary-foreground">· {items.length} POD{items.length === 1 ? "" : "s"}</span>
                  </h3>
                  <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {items.map((g) => (
                      <li key={g.id} className="overflow-hidden rounded-lg border border-border bg-card">
                        <a href={g.image_url ?? `/api/pod/${g.id}/image`} target="_blank" rel="noreferrer" className="block aspect-square bg-muted">
                          {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary already sizes the thumbnail */}
                          <img src={g.image_url ? thumb(g.image_url) : `/api/pod/${g.id}/image`} alt={`POD for invoice ${g.invoice_no}`} loading="lazy" className="size-full object-cover" />
                        </a>
                        <div className="flex items-center justify-between gap-2 px-3 py-2">
                          <div className="min-w-0">
                            <div className="truncate text-[13px] font-semibold" title={g.customer_name ?? ""}>{g.customer_name || "—"}</div>
                            <div className="num truncate text-[12px]">{g.invoice_no}</div>
                            <div className="truncate text-[11px] text-tertiary-foreground">{g.created_by ?? ""}</div>
                          </div>
                          {canEdit ? <DeleteGrn id={g.id} invoice={g.invoice_no} /> : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
