import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { buttonVariants } from "@/components/ui/button";
import { EmployeeAdmin } from "@/components/employees/EmployeeAdmin";
import {
  A, Account, Avatar, Breakdown, Card, Chain, Details, Empty, Header, History, Layout, MonthBars, Stats, Table, Tabs, Tag,
  ago, day, rs, rsShort, td, tdNum, when,
} from "@/components/profile/parts";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { one } from "@/lib/db";
import { employeeProfile, listDepartments, unlinkedUsers, wingLabel } from "@/lib/employees";
import { employeeExtras, type OrderLine } from "@/lib/profiles";

export const dynamic = "force-dynamic";

const TABS = ["overview", "team", "customers", "access", "history"] as const;
type Tab = (typeof TABS)[number];
const time = (d: Date | string) => new Date(d).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });

/**
 * One employee, laid out like a detail page: header and key numbers, then activity in tabs (overview, team,
 * customers and sales, logins and access, history) beside a column with their personal and job details.
 */
export default async function EmployeeProfilePage({ params, searchParams }: { params: Promise<{ uid: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { uid } = await params;
  const sp = await searchParams;
  const tab: Tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as Tab) : "overview";
  const e = await employeeProfile(uid);
  if (!e) notFound();
  const me = await userFromToken((await cookies()).get("session")?.value);
  const canEdit = !!me && atLeast(levelFor(me, "employees"), "edit");
  const isOwner = me?.role === "owner";
  const [x, departments, free, linked] = await Promise.all([
    employeeExtras(uid),
    tab === "access" && canEdit ? listDepartments() : Promise.resolve([]),
    tab === "access" && canEdit ? unlinkedUsers() : Promise.resolve([]),
    tab === "access" && e.dashboardUserId ? one<{ id: string; email: string; name: string }>(`select id, email, name from app_user where id = $1`, [e.dashboardUserId]) : Promise.resolve(null),
  ]);
  const users = linked ? [linked, ...free] : free;
  const first = e.name.split(" ")[0];
  const base = `/employees/staff/${e.uid}`;
  const logins = [x.accounts.employeeApp, x.accounts.dashboard, ...x.accounts.salesforce].filter(Boolean).length;
  const chain = x.chain.map((p) => ({ href: `/employees/staff/${p.uid}`, name: p.name, sub: p.designation }));

  const main = (
    <>
      <Tabs base={base} on={tab} tabs={[
        { key: "overview", label: "Overview" },
        { key: "team", label: "Team", count: x.team.total },
        { key: "customers", label: "Customers & sales", count: x.customers.total },
        { key: "access", label: "Logins & access", count: logins },
        { key: "history", label: "History", count: x.history.length },
      ]} />

      {tab === "overview" ? (
        <>
          <Card title="Orders" note={`Last 12 months, from the customers ${first} looks after`}><MonthBars months={x.monthly} /></Card>
          <div className="grid gap-x-12 gap-y-10 lg:grid-cols-2">
            <Card title="Reporting line"><Chain above={chain} self={{ name: e.name, sub: e.designation }} empty="Reports to no one." /></Card>
            <Card title="Direct reports" note={x.team.total > x.team.direct ? `${x.team.total} in the whole team` : undefined}>
              <People people={e.reports} limit={6} />
              {e.reports.length > 6 ? <A href={`${base}?tab=team`} className="mt-2 inline-block text-[13px]">All {e.reports.length} →</A> : null}
            </Card>
          </div>
          <RecentOrders orders={x.recent.slice(0, 5)} />
        </>
      ) : null}

      {tab === "team" ? (
        <>
          <Card title="Direct reports" note={`${e.reports.length} people whose reporting manager is ${first}`}><People people={e.reports} columns /></Card>
          <div className="grid gap-x-12 gap-y-10 lg:grid-cols-2">
            <Card title="Whole team" note={`${x.team.total} active people at every level below ${first}`}>
              {x.team.byDesignation.length ? <Breakdown rows={x.team.byDesignation.map((d) => ({ label: d.designation, n: d.n }))} total={x.team.total} /> : <Empty>No team yet.</Empty>}
            </Card>
            <Card title="Reporting line"><Chain above={chain} self={{ name: e.name, sub: e.designation }} empty="Reports to no one." /></Card>
          </div>
          {isOwner ? <p className="text-[13px] text-tertiary-foreground">The full chart is in <A href="/hierarchy">Admin › Hierarchy</A>.</p> : null}
        </>
      ) : null}

      {tab === "customers" ? (
        <>
          <Card title="Orders by month" note="Orders they took, and orders from the customers they look after"><MonthBars months={x.monthly} /></Card>
          <Card title="Customers they look after" note={x.customers.total > x.customers.top.length ? `Top ${x.customers.top.length} of ${x.customers.total.toLocaleString("en-IN")} by order value` : "Customers whose sales officer is set to them"}>
            {x.customers.top.length ? (
              <Table head={["Customer", "Channel", "City", "Orders", "Value"]} right={[3, 4]}>
                {x.customers.top.map((c) => (
                  <tr key={c.uid}>
                    <td className={td}><A href={`/customers/firm/${c.uid}`}>{c.name}</A>{c.active ? null : <span className="ml-2 text-tertiary-foreground">inactive</span>}</td>
                    <td className={`${td} text-foreground/70`}>{c.kind}</td>
                    <td className={`${td} text-foreground/70`}>{c.city ?? "—"}</td>
                    <td className={tdNum}>{c.orders || "—"}</td>
                    <td className={tdNum}>{c.value ? rs(c.value) : "—"}</td>
                  </tr>
                ))}
              </Table>
            ) : <Empty>No customer has {first} as their sales officer.</Empty>}
          </Card>
          <div className="grid gap-x-12 gap-y-10 lg:grid-cols-2">
            <Card title="By channel">{x.customers.byKind.length ? <Breakdown rows={x.customers.byKind.map((k) => ({ label: k.kind, n: k.n }))} total={x.customers.total} /> : <Empty>None yet.</Empty>}</Card>
            <Card title="Beats">
              {x.beats.length ? (
                <ul className="divide-y divide-border text-[13px]">
                  {x.beats.map((b) => <li key={`${b.name}${b.code}`} className="flex justify-between gap-3 py-2.5"><span className="truncate">{b.name}</span><span className="text-tertiary-foreground">{[b.day, b.city].filter(Boolean).join(" · ")}</span></li>)}
                </ul>
              ) : <Empty>No beat is assigned.</Empty>}
            </Card>
          </div>
          <RecentOrders orders={x.recent} />
        </>
      ) : null}

      {tab === "access" ? (
        <>
          <Card title="Logins" note="Every app login that is this employee">
            <Account title="Employee app" id={x.accounts.employeeApp?.phone ?? "No login"}
              status={x.accounts.employeeApp ? (x.accounts.employeeApp.active ? "On" : "Off") : undefined}
              meta={x.accounts.employeeApp ? [x.accounts.employeeApp.lastLogin ? `Last signed in ${when(x.accounts.employeeApp.lastLogin)}` : "Never signed in", x.accounts.employeeApp.device].filter(Boolean).join(" · ") : "Attendance, leave, claims and payslips"} />
            {x.accounts.salesforce.length ? x.accounts.salesforce.map((s) => (
              <Account key={s.phone} title="Salesforce app" id={s.phone} status={s.active ? "On" : "Off"} meta={s.since ? `Sales officer login since ${day(s.since)}` : undefined} />
            )) : <Account title="Salesforce app" id="No login" meta="Taking orders in the field" />}
            <Account title="Dashboard" id={x.accounts.dashboard?.email ?? "No login"}
              status={x.accounts.dashboard ? (!x.accounts.dashboard.active ? "Off" : x.accounts.dashboard.role === "owner" ? "Owner" : "On") : undefined}
              meta={x.accounts.dashboard ? [x.accounts.dashboard.mobile, x.accounts.dashboard.since ? `since ${day(x.accounts.dashboard.since)}` : null].filter(Boolean).join(" · ") || undefined : "Link one under HR settings to give office access"}
              href={isOwner && x.accounts.dashboard ? "/users" : undefined} />
          </Card>

          <Card title="Dashboard access"
            note={!isOwner ? "Visible to owners only" : x.access ? `${x.access.role === "owner" ? "Owner" : `${x.access.rows.length} areas`}${x.access.department ? ` · from the ${x.access.department} department and personal grants` : ""}` : undefined}
            action={isOwner && x.access ? <Link href="/users" className={buttonVariants({ variant: "outline", size: "sm" })}>Change</Link> : null}>
            {!isOwner ? <Empty>Only owners can see what a login can open.</Empty>
              : !x.access ? <Empty>No dashboard login, so no dashboard access.</Empty>
              : x.access.role === "owner" ? <Empty>Owners can open and change everything.</Empty>
              : x.access.rows.length ? <AccessList rows={x.access.rows} />
              : <Empty>Nothing is opened up for this login yet.</Empty>}
          </Card>

          {canEdit ? (
            <Card title="HR settings" note="Group, department and the dashboard login that is them">
              <div className="-mx-4"><EmployeeAdmin uid={e.uid} wing={e.wingSet ? e.wing : null} departmentId={e.departmentId} departments={departments} dashboardUserId={e.dashboardUserId} users={users} /></div>
            </Card>
          ) : null}

          <Card title="Recent working days" note="Salesforce day start and end, and Employee app attendance">
            {x.days.length ? (
              <ul className="divide-y divide-border text-[13px]">
                {x.days.map((d) => (
                  <li key={d.date} className="flex justify-between gap-3 py-2.5">
                    <span>{day(d.date)}</span>
                    <span className="tabular-nums text-tertiary-foreground">{d.start ? `${time(d.start)}${d.end ? ` – ${time(d.end)}` : ""}` : "present"}</span>
                  </li>
                ))}
              </ul>
            ) : <Empty>No attendance recorded yet.</Empty>}
          </Card>
        </>
      ) : null}

      {tab === "history" ? <Card title="Changes to this record" note="Edits made in the dashboard, newest first"><History rows={x.history} /></Card> : null}
    </>
  );

  const side = (
    <Details groups={[
      { title: "Job", rows: [
        ["Group", e.wing && !e.wingSet ? `${wingLabel(e.wing)} (from designation)` : wingLabel(e.wing)],
        ["Department", e.department],
        ["Designation", e.designation],
        ["Employee code", e.code, true],
        ["Reports to", e.managerUid && e.manager ? <A href={`/employees/staff/${e.managerUid}`}>{e.manager}</A> : null],
        ["Joined", e.joined ? `${day(e.joined)} (${ago(e.joined)})` : null],
        ["Grade", e.grade],
        ["Territory / route", [e.territory, e.route].filter(Boolean).join(" / ")],
        ["Works for", e.firm],
        ["This month", e.month && (e.month.present || e.month.leaves) ? `${e.month.present} days present · ${e.month.leaves} on leave` : null],
        ["Resigned", day(e.resignedOn)],
        ["Left on", day(e.leftOn)],
      ] },
      { title: "Contact", rows: [
        ["Mobile", e.phone ? <a href={`tel:${e.phone}`} className="hover:underline">{e.phone}</a> : null],
        ["Email", e.email ? <a href={`mailto:${e.email}`} className="hover:underline">{e.email}</a> : null],
        ["Address", [e.address, e.city, e.state, e.pincode].filter(Boolean).join(", ")],
        ["Emergency contact", e.own?.emergencyName ? `${e.own.emergencyName}${e.own.emergencyRel ? ` (${e.own.emergencyRel})` : ""}${e.own.emergencyPhone ? `, ${e.own.emergencyPhone}` : ""}` : null],
      ] },
      { title: "Personal", rows: [
        ["Gender", e.gender],
        ["Birthday", day(e.birthday)],
        ["Blood group", e.own?.bloodGroup],
        ["Aadhaar", e.aadhaar, true],
        ["PAN", e.pan, true],
        ["Bank", e.own?.bankName ? [e.own.bankName, e.own.accountNo, e.own.ifsc].filter(Boolean).join(" · ") : null],
      ] },
    ]} />
  );

  return (
    <div className="flex flex-1 flex-col bg-background px-4 py-6 md:px-10 md:py-8">
      <div className="mx-auto w-full max-w-[1280px] space-y-8">
        <Header
          back={{ href: `/employees/${e.wing ?? "unset"}`, label: `Employee Master · ${wingLabel(e.wing)}` }}
          name={e.name}
          photo={e.hasPhoto ? `/api/employees/photo/${e.uid}` : null}
          tags={<><Tag strong>{e.active ? "Active" : "Left"}</Tag><Tag>{wingLabel(e.wing)}</Tag></>}
          line={[e.designation, e.department, e.code, e.phone]}
          actions={<>
            {isOwner ? <Link href="/hierarchy" className={buttonVariants({ variant: "outline" })}>Hierarchy</Link> : null}
            <Link href={`/orders/staffs/${e.uid}`} className={buttonVariants({ variant: "outline" })}>Edit</Link>
          </>}
        />
        <Stats items={[
          { label: "Team", value: x.team.total.toLocaleString("en-IN"), note: `${x.team.direct} direct` },
          { label: "Customers handled", value: x.customers.total.toLocaleString("en-IN"), note: `${x.customers.active.toLocaleString("en-IN")} active` },
          { label: "Orders, 90 days", value: rsShort(x.stats.value90), note: `${x.stats.orders90} orders` },
          { label: "Orders, all time", value: rsShort(x.stats.value), note: x.stats.last ? `last ${ago(x.stats.last)}` : "none yet" },
          { label: "Logins", value: String(logins), note: [x.accounts.employeeApp && "Employee", x.accounts.salesforce.length && "Salesforce", x.accounts.dashboard && "Dashboard"].filter(Boolean).join(", ") || "none" },
        ]} />
        <Layout main={main} side={side} />
      </div>
    </div>
  );
}

function People({ people, limit, columns }: { people: Array<{ uid: string; name: string; designation: string | null }>; limit?: number; columns?: boolean }) {
  if (!people.length) return <Empty>No one reports to them.</Empty>;
  return (
    <ul className={columns ? "grid gap-x-10 sm:grid-cols-2" : ""}>
      {people.slice(0, limit ?? people.length).map((r) => (
        <li key={r.uid} className="border-b border-border last:border-b-0">
          <Link href={`/employees/staff/${r.uid}`} className="group flex items-center gap-3 py-2.5">
            <Avatar name={r.name} size={28} />
            <span className="min-w-0 flex-1 truncate text-[13px] text-foreground group-hover:underline">{r.name}</span>
            <span className="truncate text-[12px] text-tertiary-foreground">{r.designation}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function AccessList({ rows }: { rows: Array<{ group: string; label: string; level: string }> }) {
  const groups = new Map<string, typeof rows>();
  for (const r of rows) groups.set(r.group, [...(groups.get(r.group) ?? []), r]);
  return (
    <div className="grid gap-x-12 pt-2 md:grid-cols-2">
      {[...groups].map(([g, list]) => (
        <div key={g} className="mb-5">
          <div className="mb-1.5 text-[12px] text-tertiary-foreground">{g}</div>
          <ul className="divide-y divide-border">
            {list.map((r) => (
              <li key={r.label} className="flex justify-between gap-3 py-1.5 text-[13px]">
                <span className="truncate text-foreground">{r.label}</span>
                <span className="shrink-0 text-tertiary-foreground">{r.level === "edit" ? "Can change" : "View only"}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function RecentOrders({ orders }: { orders: OrderLine[] }) {
  return (
    <Card title="Latest orders">
      {orders.length ? (
        <Table head={["Order", "Placed", "Customer", "Items", "Value", "Status"]} right={[3, 4]}>
          {orders.map((o) => (
            <tr key={o.uid}>
              <td className={td}><A href={`/app-orders/${o.kind === "Retailer" ? "retailers" : "distributors"}/${o.uid}`} className="font-mono text-[12px]">{o.orderId ?? o.uid.slice(0, 8)}</A></td>
              <td className={`${td} whitespace-nowrap text-foreground/70`}>{when(o.at)}</td>
              <td className={td}>{o.firmUid ? <A href={`/customers/firm/${o.firmUid}`}>{o.firm}</A> : "—"}</td>
              <td className={tdNum}>{o.items}</td>
              <td className={tdNum}>{rs(o.total)}</td>
              <td className={`${td} text-foreground/70`}>{o.status}</td>
            </tr>
          ))}
        </Table>
      ) : <Empty>No orders yet.</Empty>}
    </Card>
  );
}
