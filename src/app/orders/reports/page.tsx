import { Download, FileDown } from "lucide-react";
import { SectionShell } from "@/components/orders/SectionShell";
import { REPORTS } from "@/lib/orders/insights";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <SectionShell icon={FileDown} title="Download Reports" subtitle="Each report downloads as a CSV that opens in Excel.">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {REPORTS.map((r) => (
          <div key={r.key} className="flex flex-col justify-between gap-3 rounded-lg border border-border bg-card p-4">
            <div>
              <h2 className="text-[14px] font-semibold text-foreground">{r.title}</h2>
              <p className="mt-1 text-[12px] text-muted-foreground">{r.description}</p>
            </div>
            <a href={`/api/orders/reports?key=${r.key}`} download
              className="inline-flex h-8 w-fit items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-[12px] font-medium hover:bg-muted">
              <Download className="h-3.5 w-3.5" /> Download CSV
            </a>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}
