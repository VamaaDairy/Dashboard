import { LayoutDashboard } from "lucide-react";
import { Panel } from "@/components/orders/common";
import { SectionShell } from "@/components/orders/SectionShell";
import { companyDashboard, dashFilters, filterOptions } from "@/lib/fp/dash";
import { BarList, DashFilterBar, Grid, inr, num, pct, Tile, TrendBars } from "./Widgets";

/** /fp/companyDashboard (the sidebar's "Dashboard"): attendance, coverage, orders, ranking, branches, productivity. */
export async function CompanyDashboardView({ sp, path = "/fp/companyDashboard" }: { sp: Record<string, string>; path?: string }) {
  const f = dashFilters(sp);
  const [d, opts] = await Promise.all([companyDashboard(f), filterOptions()]);
  const a = d.attendance, c = d.coverage, o = d.orders;

  return (
    <SectionShell icon={LayoutDashboard} title="Dashboard" subtitle={`${f.from} to ${f.to}`}>
      <DashFilterBar path={path} f={f} opts={opts} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tile title="Active employees" value={String(a.active)} />
        <Tile title="Logged in" value={String(a.loggedIn)} hint={`on ${f.to}`} tone="good" />
        <Tile title="Not logged in" value={String(a.notLoggedIn)} tone={a.notLoggedIn ? "warn" : undefined} />
        <Tile title="On leave" value={String(a.onLeave)} />
        <Tile title="On visits" value={String(a.onVisit)} hint="had a scheduled call" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tile title="Orders" value={String(o.count)} hint={`${o.accepted} accepted · ${o.pending} pending · ${o.cancelled} cancelled`} />
        <Tile title="Order value" value={inr(o.value)} hint={`${num(o.qty)} units`} />
        <Tile title="Secondary" value={inr(o.secondaryValue)} />
        <Tile title="Primary" value={inr(o.primaryValue)} />
        <Tile title="Call productivity" value={pct(c.productive, c.completed)} hint={`${c.productive} of ${c.completed} completed calls took an order`} tone="good" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Order value by day"><TrendBars rows={d.trend} /></Panel>
        <Panel title="Activity coverage">
          <BarList rows={[
            { label: "Scheduled calls", value: c.scheduled }, { label: "Completed", value: c.completed },
            { label: "Productive (order booked)", value: c.productive }, { label: "Mark visits", value: c.markVisit },
          ]} />
          <p className="border-t border-border px-4 py-2 text-[12px] text-muted-foreground">Coverage {pct(c.completed, c.scheduled)} of scheduled calls completed.</p>
        </Panel>
        <Panel title="Employee ranking">
          <Grid head={["Employee", "Orders", "Order value", "Visits"]} right={[1, 2, 3]}
            rows={d.ranking.map((r) => [r.name, r.orders, inr(r.value), r.visits])} />
        </Panel>
        <Panel title="Branch / team summary">
          <Grid head={["Branch / team", "Employees", "Orders", "Order value"]} right={[1, 2, 3]}
            rows={d.branches.map((b) => [b.team, b.staff, b.orders, inr(b.value)])} />
        </Panel>
      </div>
      <Panel title="Productivity by designation">
        <Grid head={["Designation", "Employees", "Visits", "Productive", "Strike rate"]} right={[1, 2, 3, 4]}
          rows={d.productivity.map((p) => [p.designation, p.staff, p.visits, p.productive, pct(p.productive, p.visits)])} />
      </Panel>
    </SectionShell>
  );
}
