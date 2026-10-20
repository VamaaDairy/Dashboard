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

export const dynamic = "force-dynamic";

export default async function GrnPage({ searchParams }: PageProps<"/grn">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const me = await userFromToken((await cookies()).get("session")?.value);
  const canEdit = !!me && atLeast(levelFor(me, "grn"), "edit");
  const rows = await listGrns(q);

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="mx-auto w-full max-w-5xl space-y-5">
        <PageHeader icon={PackageCheck} title="GRN" subtitle="The goods-received image kept against each invoice number." />

        {canEdit ? <GrnForm /> : null}

        <Panel
          title="Saved GRNs"
          flush
          actions={
            <form action="/grn" className="w-56">
              <Input name="q" defaultValue={q} placeholder="Search invoice no." className="h-8" />
            </form>
          }
        >
          {rows.length === 0 ? (
            <EmptyState icon={SearchX} title={q ? "No GRN matches that invoice" : "No GRN added yet"} />
          ) : (
            <ul className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">
              {rows.map((g) => (
                <li key={g.id} className="overflow-hidden rounded-lg border border-border bg-card">
                  <a href={g.image_url ?? `/api/grn/${g.id}/image`} target="_blank" rel="noreferrer" className="block aspect-square bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary already sizes the thumbnail */}
                    <img src={g.image_url ? thumb(g.image_url) : `/api/grn/${g.id}/image`} alt={`GRN for invoice ${g.invoice_no}`} loading="lazy" className="size-full object-cover" />
                  </a>
                  <div className="flex items-center justify-between gap-2 px-3 py-2">
                    <div className="min-w-0">
                      <div className="num truncate text-[13px] font-semibold">{g.invoice_no}</div>
                      <div className="truncate text-[11px] text-tertiary-foreground">{g.created_at}{g.created_by ? ` · ${g.created_by}` : ""}</div>
                    </div>
                    {canEdit ? <DeleteGrn id={g.id} invoice={g.invoice_no} /> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
