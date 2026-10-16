import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Panel } from "@/components/orders/common";
import { SectionShell } from "@/components/orders/SectionShell";
import { dashFilters, filterOptions, type DashFilters } from "@/lib/fp/dash";
import type { Report } from "@/lib/fp/insights";
import { DashFilterBar } from "./Widgets";
import { ReportTable } from "./ReportTable";

/** Filter bar + a computed report table (sortable, filterable, CSV) under the standard Footprints heading. */
export async function ReportScreen({ icon, title, subtitle, path, sp, load, day = false, show, tabs, above }: {
  icon: LucideIcon; title: string; subtitle?: string; path: string; sp: Record<string, string>;
  load: (f: DashFilters) => Promise<Report>; day?: boolean; show?: string[];
  tabs?: Array<{ key: string; label: string }>; above?: ReactNode;
}) {
  const f = dashFilters(sp);
  const [report, opts] = await Promise.all([load(f), filterOptions()]);
  const qs = (patch: Record<string, string>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) u.set(k, v);
    return `${path}?${u.toString()}`;
  };
  return (
    <SectionShell icon={icon} title={title} subtitle={subtitle ?? (day ? f.to : `${f.from} to ${f.to}`)}>
      <DashFilterBar path={path} f={f} opts={opts} day={day} show={show} extra={tabs ? <input type="hidden" name="field" value={sp.field ?? tabs[0].key} /> : undefined} />
      {above}
      {tabs && (
        <div className="flex gap-1 overflow-x-auto border-b border-border">
          {tabs.map((t) => (
            <Link key={t.key} href={qs({ field: t.key })} className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-[13px] font-medium ${(sp.field ?? tabs[0].key) === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{t.label}</Link>
          ))}
        </div>
      )}
      <Panel title={`${report.rows.length} row${report.rows.length === 1 ? "" : "s"}`}>
        <ReportTable head={report.head} rows={report.rows} right={report.right} tone={report.tone} name={title.toLowerCase().replace(/\W+/g, "-")} />
      </Panel>
    </SectionShell>
  );
}
