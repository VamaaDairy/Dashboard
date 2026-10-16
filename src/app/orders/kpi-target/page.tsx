import { Target } from "lucide-react";
import { EntityPanel } from "@/components/orders/EntityPanel";
import { inr, Panel, TD, TH } from "@/components/orders/common";
import { SectionShell } from "@/components/orders/SectionShell";
import { pickTab, SectionTabs, type TabDef } from "@/components/orders/SectionTabs";
import { kpiProgress, type KpiRow } from "@/lib/orders/insights";
import { params, type SP } from "@/lib/orders/session";

export const dynamic = "force-dynamic";

const TABS: TabDef[] = [{ key: "progress", label: "Target vs achieved" }, { key: "kpi_target", label: "Set targets" }];
const METRICS: Array<{ key: keyof Omit<KpiRow, "staff">; label: string; money?: boolean }> = [
  { key: "sales", label: "Sales", money: true }, { key: "orders", label: "Orders" },
  { key: "visits", label: "Visits" }, { key: "new_outlets", label: "New outlets" },
];

function thisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function Bar({ target, achieved, money }: { target: number; achieved: number; money?: boolean }) {
  const fmt = (n: number) => (money ? inr(n) : String(n));
  if (!target) return <span className="text-muted-foreground">{fmt(achieved)} <span className="text-[11px]">(no target)</span></span>;
  const pct = Math.round((achieved / target) * 100);
  const tone = pct >= 100 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : "bg-destructive";
  return (
    <div className="min-w-36">
      <div className="flex justify-between text-[12px] tabular-nums"><span className="text-foreground">{fmt(achieved)}</span><span className="text-muted-foreground">of {fmt(target)} · {pct}%</span></div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className={`h-full ${tone}`} style={{ width: `${Math.min(100, pct)}%` }} /></div>
    </div>
  );
}

export default async function Page({ searchParams }: { searchParams: SP }) {
  const sp = await params(searchParams);
  const tab = pickTab(TABS, sp.t);
  const month = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m : thisMonth();
  const rows = tab === "progress" ? await kpiProgress(month) : [];

  return (
    <SectionShell icon={Target} title="KPI Target" subtitle="Monthly targets for sales, orders, visits and new outlets - achieved is worked out from orders, visits and customers.">
      <SectionTabs path="/orders/kpi-target" tabs={TABS} active={tab} />
      {tab === "progress" ? (
        <Panel
          title={`Month ${month}`}
          actions={
            <form action="/orders/kpi-target" className="flex items-center gap-2">
              <input type="month" name="m" defaultValue={month} className="h-8 rounded-lg border border-border bg-background px-2 text-[13px]" />
              <button className="h-8 rounded-lg border border-border bg-white px-3 text-[12px] font-medium hover:bg-muted">Show</button>
            </form>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="border-b border-border bg-muted/40">
                <tr><th className={TH}>Employee</th>{METRICS.map((m) => <th key={m.key} className={TH}>{m.label}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.staff} className="border-b border-border/70">
                    <td className={`${TD} font-medium text-foreground`}>{r.staff}</td>
                    {METRICS.map((m) => <td key={m.key} className={TD}><Bar target={r[m.key][0]} achieved={r[m.key][1]} money={m.money} /></td>)}
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No active employees yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : (
        <EntityPanel entity="kpi_target" path="/orders/kpi-target" tab={tab} access="orders.kpi" sp={sp} filterBy={["metric"]} />
      )}
    </SectionShell>
  );
}
