import { BarChart3 } from "lucide-react";
import { inr, Panel, TD, TH } from "@/components/orders/common";
import { SectionShell } from "@/components/orders/SectionShell";
import { pickTab, SectionTabs, type TabDef } from "@/components/orders/SectionTabs";
import { TeamMap } from "@/components/orders/TeamMap";
import {
  attendanceSummary, categoryInsights, coverage, dailySales, dayWiseVisits, mapPoints, productivity,
} from "@/lib/orders/analytics";
import { params, type SP } from "@/lib/orders/session";

export const dynamic = "force-dynamic";

const TABS: TabDef[] = [
  { key: "daywise", label: "Day-wise visits" },
  { key: "coverage", label: "Coverage" },
  { key: "productivity", label: "Productivity" },
  { key: "category", label: "Category insights" },
  { key: "sales", label: "Daily sales" },
  { key: "attendance", label: "Attendance" },
  { key: "map", label: "Team & outlet map" },
];

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const cell = "px-4 py-2 text-right tabular-nums";
const R = `${TH} text-right`;

export default async function Page({ searchParams }: { searchParams: SP }) {
  const sp = await params(searchParams);
  const tab = pickTab(TABS, sp.t);

  return (
    <SectionShell icon={BarChart3} title="Insights" subtitle="Field activity and sales read from visits, attendance and orders - nothing to enter here.">
      <SectionTabs path="/orders/insights" tabs={TABS} active={tab} />
      {tab === "daywise" && <DayWise />}
      {tab === "coverage" && <Coverage />}
      {tab === "productivity" && <Productivity />}
      {tab === "category" && <Category />}
      {tab === "sales" && <Daily />}
      {tab === "attendance" && <Attendance />}
      {tab === "map" && <Panel title="Latest employee positions and outlets"><TeamMap points={await mapPoints()} /></Panel>}
    </SectionShell>
  );
}

async function DayWise() {
  const { days, rows } = await dayWiseVisits();
  const tone = (visits: number, status: string | null) =>
    status === "leave" ? "bg-sky-500/20 text-sky-700"
    : status === "absent" ? "bg-destructive/15 text-destructive"
    : visits >= 3 ? "bg-emerald-500/20 text-emerald-700"
    : visits >= 1 ? "bg-amber-500/20 text-amber-700"
    : status === "present" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground";
  return (
    <Panel title="Visits per day (last 14 days)">
      <div className="flex flex-wrap gap-3 border-b border-border px-4 py-2 text-[12px] text-muted-foreground">
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500/60" />3+ visits</span>
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-amber-500/60" />1–2 visits</span>
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-destructive/50" />present with no visit, or absent</span>
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-sky-500/50" />leave</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className={TH}>Employee</th>
              {days.map((d) => <th key={d} className="px-1 py-2 text-center text-[10px] font-medium text-muted-foreground">{d.slice(8)}/{d.slice(5, 7)}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.staff} className="border-b border-border/70">
                <td className={`${TD} whitespace-nowrap font-medium text-foreground`}>{r.staff}</td>
                {r.days.map((d) => (
                  <td key={d.day} className="p-0.5">
                    <div className={`flex h-7 min-w-8 items-center justify-center rounded ${tone(d.visits, d.status)}`}>
                      {d.visits || (d.status === "leave" ? "L" : d.status === "absent" ? "A" : "")}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

async function Coverage() {
  const rows = await coverage();
  return (
    <Panel title="Outlet coverage this month">
      <table className="w-full text-[13px]">
        <thead className="border-b border-border bg-muted/40">
          <tr><th className={TH}>Employee</th><th className={R}>Outlets</th><th className={R}>Visited</th><th className={R}>Coverage</th><th className={R}>Billed</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.staff} className="border-b border-border/70">
              <td className={`${TD} font-medium text-foreground`}>{r.staff}</td>
              <td className={cell}>{r.customers}</td>
              <td className={cell}>{r.visited}</td>
              <td className={cell}>{pct(r.visited, r.customers)}%</td>
              <td className={cell}>{r.billed} <span className="text-muted-foreground">({pct(r.billed, r.customers)}%)</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

async function Productivity() {
  const rows = await productivity();
  return (
    <Panel title="Productivity this month">
      <table className="w-full text-[13px]">
        <thead className="border-b border-border bg-muted/40">
          <tr><th className={TH}>Employee</th><th className={R}>Visits</th><th className={R}>Productive</th><th className={R}>Strike rate</th><th className={R}>Orders</th><th className={R}>Sales</th><th className={R}>Avg order</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.staff} className="border-b border-border/70">
              <td className={`${TD} font-medium text-foreground`}>{r.staff}</td>
              <td className={cell}>{r.visits}</td>
              <td className={cell}>{r.productive}</td>
              <td className={cell}>{pct(r.productive, r.visits)}%</td>
              <td className={cell}>{r.orders}</td>
              <td className={cell}>{inr(r.value)}</td>
              <td className={cell}>{inr(Math.round(r.avg))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

async function Category() {
  const rows = await categoryInsights();
  return (
    <Panel title="Sales by product category">
      <table className="w-full text-[13px]">
        <thead className="border-b border-border bg-muted/40">
          <tr><th className={TH}>Category</th><th className={R}>Qty (month)</th><th className={R}>This month</th><th className={R}>Last month</th><th className={R}>Change</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const ch = r.last_month ? Math.round(((r.this_month - r.last_month) / r.last_month) * 100) : null;
            return (
              <tr key={r.category} className="border-b border-border/70">
                <td className={`${TD} font-medium text-foreground`}>{r.category}</td>
                <td className={cell}>{r.qty}</td>
                <td className={cell}>{inr(r.this_month)}</td>
                <td className={cell}>{inr(r.last_month)}</td>
                <td className={`${cell} ${ch === null ? "text-muted-foreground" : ch >= 0 ? "text-emerald-700" : "text-destructive"}`}>
                  {ch === null ? "—" : `${ch > 0 ? "+" : ""}${ch}%`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Panel>
  );
}

async function Daily() {
  const rows = await dailySales(30);
  return (
    <Panel title="Sales by day (last 30 days)">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="border-b border-border bg-muted/40">
            <tr><th className={TH}>Date</th><th className={R}>Orders</th><th className={R}>Primary</th><th className={R}>Secondary</th><th className={R}>Counter</th><th className={R}>Total</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.day} className="border-b border-border/70">
                <td className={`${TD} text-foreground`}>{r.day}</td>
                <td className={cell}>{r.orders}</td>
                <td className={cell}>{inr(r.primary_v)}</td>
                <td className={cell}>{inr(r.secondary_v)}</td>
                <td className={cell}>{inr(r.counter_v)}</td>
                <td className={`${cell} font-medium text-foreground`}>{inr(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

async function Attendance() {
  const rows = await attendanceSummary();
  return (
    <Panel title="Attendance this month">
      <table className="w-full text-[13px]">
        <thead className="border-b border-border bg-muted/40">
          <tr><th className={TH}>Employee</th><th className={R}>Present</th><th className={R}>Half day</th><th className={R}>Leave</th><th className={R}>Absent</th><th className={R}>Marked</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.staff} className="border-b border-border/70">
              <td className={`${TD} font-medium text-foreground`}>{r.staff}</td>
              <td className={cell}>{r.present}</td>
              <td className={cell}>{r.half}</td>
              <td className={cell}>{r.leave}</td>
              <td className={cell}>{r.absent}</td>
              <td className={cell}>{r.marked}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}
