import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Package } from "lucide-react";
import { BomEditor } from "@/components/BomEditor";
import { EditableCell } from "@/components/EditableCell";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { getImpact, getObjectDetail } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ObjectPage({ params }: PageProps<"/c/[classCode]/[objectCode]">) {
  const { classCode, objectCode } = await params;
  const detail = await getObjectDetail(classCode, objectCode);
  if (!detail) notFound();

  const { object, fields, cells, lines, components } = detail;
  const impact = await getImpact(
    `field:${object.code}.${object.cost_field ?? fields[fields.length - 1]?.key}`,
  );

  const groups: Array<{ label: string; fields: typeof fields }> = [];
  for (const f of fields) {
    const label = f.group_label ?? "Other";
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.fields.push(f);
    else groups.push({ label, fields: [f] });
  }

  return (
    <div className="flex flex-col flex-1 bg-white p-4 md:p-6 min-h-screen">
      <div className="w-full space-y-5">
        <PageHeader
          icon={Package}
          title={object.name}
          subtitle={object.notes ?? object.class_name}
          actions={
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline" className="border-blue-200 bg-blue-50/60 text-[#2B4C86] font-mono font-bold text-xs">
                {object.code}
              </Badge>
              <Link
                href={`/c/${classCode}`}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[#3E5FA0]"
              >
                ← {object.class_name}
              </Link>
            </div>
          }
        />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3 font-bold text-slate-700">Cost sheet</div>
            <table className="w-full text-[13px]">
              <tbody>
                {groups.map((g) => (
                  <Fragment key={g.label}>
                    <tr>
                      <td
                        colSpan={2}
                        className="bg-[#F8FAFD] px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#2B4C86]"
                      >
                        {g.label}
                      </td>
                    </tr>
                    {g.fields.map((f) => (
                      <tr key={f.id} className="border-b border-slate-100">
                        <td className="px-4 py-1.5" title={f.description ?? undefined}>
                          {f.label}
                          {f.suffix ? <span className="ml-1 text-slate-500">{f.suffix}</span> : null}
                          <div className="font-mono text-[10px] text-slate-400">{f.key}</div>
                        </td>
                        <EditableCell
                          objectId={object.id}
                          fieldId={f.id}
                          cell={cells[f.key]}
                          decimals={f.decimals}
                          dataType={f.data_type}
                          suffix={f.suffix}
                          isTotal={f.is_total}
                          rollupGroup={f.rollup_group}
                        />
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </section>

          <div className="flex flex-col gap-5">
            <BomEditor parentId={object.id} lines={lines} components={components} />

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-4 py-3">
                <span className="font-bold text-slate-700">What this feeds</span>
                <span className="ml-2 text-[11px] font-normal text-slate-500">
                  values that change when {object.cost_field ?? "this"} changes
                </span>
              </div>
              {impact.length ? (
                <ul className="max-h-72 overflow-auto px-4 py-2 font-mono text-[11px] leading-5">
                  {impact.map((i) => (
                    <li key={i.ref} className="flex justify-between gap-3">
                      <span className="truncate">{i.ref.replace(/^field:/, "")}</span>
                      <span className="text-slate-400">depth {i.depth}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-3 text-[12px] text-slate-500">Nothing depends on this yet.</p>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
