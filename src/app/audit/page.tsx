import { FileClock } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { getChangeLog } from "@/lib/data";

export const dynamic = "force-dynamic";

const INTERESTING = ["formula", "value_num", "value_text", "label", "name", "qty", "rate",
  "divisor", "default_formula", "default_value", "code", "notes", "is_active", "cost_field"];

function summarise(
  action: string,
  oldRow: Record<string, unknown> | null,
  newRow: Record<string, unknown> | null,
): string {
  if (action === "insert") return "created";
  if (action === "delete") return "deleted";
  const changes: string[] = [];
  for (const key of INTERESTING) {
    const before = oldRow?.[key];
    const after = newRow?.[key];
    if (before === after) continue;
    if (before == null && after == null) continue;
    changes.push(`${key}: ${before ?? "—"} → ${after ?? "—"}`);
  }
  return changes.join(" · ") || "updated";
}

export default async function AuditPage() {
  const entries = await getChangeLog();
  return (
    <div className="flex flex-col flex-1 bg-background p-4 md:p-6 min-h-screen">
      <div className="w-full space-y-5">
        <PageHeader
          icon={FileClock}
          title="Change log"
          subtitle="Every edit to the model. Recalculations and the initial seed load are left out - only what a person changed."
        />
        <table className="w-full overflow-hidden rounded-lg border border-border bg-card text-[13px] shadow-xs">
          <thead>
            <tr className="border-b border-border bg-secondary text-[10px] font-mono uppercase tracking-wide text-tertiary-foreground">
              <th className="px-4 py-2 text-left font-bold">When</th>
              <th className="px-3 py-2 text-left font-bold">What</th>
              <th className="px-3 py-2 text-left font-bold">Table</th>
              <th className="px-3 py-2 text-left font-bold">Action</th>
              <th className="px-3 py-2 text-left font-bold">Change</th>
              <th className="px-3 py-2 text-left font-bold">By</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-b border-border/70 hover:bg-muted">
                <td className="whitespace-nowrap px-4 py-1.5 text-[11px] text-muted-foreground">
                  {new Date(e.changed_at).toLocaleString("en-IN")}
                </td>
                <td className="px-3 py-1.5 font-mono text-[11px] text-foreground">{e.ref ?? "—"}</td>
                <td className="px-3 py-1.5 text-[11px] text-muted-foreground">{e.table_name}</td>
                <td className="px-3 py-1.5 text-[11px]">{e.action}</td>
                <td className="px-3 py-1.5 font-mono text-[11px]">
                  {summarise(e.action, e.old_row, e.new_row)}
                </td>
                <td className="px-3 py-1.5 text-[11px] text-muted-foreground">{e.actor ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {entries.length === 0 ? (
          <p className="mt-4 text-[12px] text-muted-foreground">No changes recorded yet.</p>
        ) : null}
      </div>
    </div>
  );
}
