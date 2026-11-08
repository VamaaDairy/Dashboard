import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { ArrowLeft, Pencil, Phone, UserRound } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Panel, Pill } from "@/components/cn/ui";
import { Field } from "@/app/app-orders/parts";
import { EmployeeAdmin } from "@/components/employees/EmployeeAdmin";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { one } from "@/lib/db";
import { employeeProfile, listDepartments, unlinkedUsers, wingLabel } from "@/lib/employees";

export const dynamic = "force-dynamic";

const day = (d: Date | string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }) : null;
const when = (d: Date | string | null) =>
  d ? new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : null;

/** One employee's profile: personal, job, their own details from the Employee app, the apps they use, and HR's settings. */
export default async function EmployeeProfilePage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  const e = await employeeProfile(uid);
  if (!e) notFound();
  const me = await userFromToken((await cookies()).get("session")?.value);
  const canEdit = !!me && atLeast(levelFor(me, "employees"), "edit");
  const [departments, free, linked] = await Promise.all([
    listDepartments(),
    canEdit ? unlinkedUsers() : Promise.resolve([]),
    e.dashboardUserId ? one<{ id: string; email: string; name: string }>(`select id, email, name from app_user where id = $1`, [e.dashboardUserId]) : Promise.resolve(null),
  ]);
  const users = linked ? [linked, ...free] : free;

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-5">
        <PageHeader
          icon={UserRound}
          title={e.name}
          subtitle={
            <span className="flex flex-wrap items-center gap-2">
              {e.hasPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element -- employee photo from our own route
                <img src={`/api/employees/photo/${e.uid}`} alt="" className="size-10 rounded-full border border-border object-cover" />
              ) : null}
              <Pill tone="brand">{wingLabel(e.wing)}</Pill>
              {e.department ? <Pill dot={false}>{e.department}</Pill> : null}
              {e.designation ? <span>{e.designation}</span> : null}
              {e.code ? <span className="font-mono text-xs">{e.code}</span> : null}
              {e.active ? <Pill tone="success">Active</Pill> : <Pill>Left</Pill>}
            </span>
          }
          actions={
            <div className="flex gap-2">
              <Link href={`/employees/${e.wing ?? "unset"}`} className={buttonVariants({ variant: "outline" })}><ArrowLeft className="size-4" /> {wingLabel(e.wing)}</Link>
              <Link href={`/orders/staffs/${e.uid}`} className={buttonVariants({ variant: "outline" })}><Pencil className="size-4" /> Edit record</Link>
            </div>
          }
        />

        <div className="grid items-start gap-5 lg:grid-cols-2 2xl:grid-cols-3">
          <Panel title="Personal" flush>
            <dl className="divide-y divide-border">
              <Field label="Mobile">{e.phone ? <a href={`tel:${e.phone}`} className="inline-flex items-center gap-1 text-primary hover:underline"><Phone className="size-3.5" /> {e.phone}</a> : null}</Field>
              <Field label="Email">{e.email}</Field>
              <Field label="Gender">{e.gender}</Field>
              <Field label="Birthday">{day(e.birthday)}</Field>
              <Field label="Address">{[e.address, e.city, e.state, e.pincode].filter(Boolean).join(", ") || null}</Field>
              <Field label="Aadhaar" mono>{e.aadhaar}</Field>
              <Field label="PAN" mono>{e.pan}</Field>
              <Field label="Blood group">{e.own?.bloodGroup}</Field>
              <Field label="Emergency contact">{e.own?.emergencyName ? `${e.own.emergencyName}${e.own.emergencyRel ? ` (${e.own.emergencyRel})` : ""}${e.own.emergencyPhone ? ` · ${e.own.emergencyPhone}` : ""}` : null}</Field>
              <Field label="Bank">{e.own?.bankName ? `${e.own.bankName}${e.own.accountNo ? ` · ${e.own.accountNo}` : ""}${e.own.ifsc ? ` · ${e.own.ifsc}` : ""}` : null}</Field>
            </dl>
          </Panel>

          <Panel title="Job" flush>
            <dl className="divide-y divide-border">
              <Field label="Group">{wingLabel(e.wing)}{e.wing && !e.wingSet ? <span className="ml-1 text-xs text-amber-600">(by designation - confirm)</span> : null}</Field>
              <Field label="Department">{e.department}</Field>
              <Field label="Designation">{e.designation}</Field>
              <Field label="Employee code" mono>{e.code}</Field>
              <Field label="Reports to">{e.managerUid && e.manager ? <Link href={`/employees/staff/${e.managerUid}`} className="text-primary hover:underline">{e.manager}</Link> : null}</Field>
              <Field label="Joined">{day(e.joined)}</Field>
              <Field label="Grade">{e.grade}</Field>
              <Field label="Territory / route">{[e.territory, e.route].filter(Boolean).join(" / ") || null}</Field>
              <Field label="Works for">{e.firm}</Field>
              <Field label="Resigned">{day(e.resignedOn)}</Field>
              <Field label="Left on">{day(e.leftOn)}</Field>
              <Field label="This month">{e.month ? `${e.month.present} day${e.month.present === 1 ? "" : "s"} present · ${e.month.leaves} leave${e.month.leaves === 1 ? "" : "s"}` : null}</Field>
            </dl>
          </Panel>

          <Panel title="Apps & access" flush>
            <dl className="divide-y divide-border">
              <Field label="Employee app">{e.employeeLogin ? `${e.employeeLogin.phone}${e.employeeLogin.active ? "" : " (off)"}${e.employeeLogin.lastLogin ? ` · last in ${when(e.employeeLogin.lastLogin)}` : ""}` : "No login"}</Field>
              <Field label="Salesforce app">{e.salesforceLogin ? `${e.salesforceLogin.phone}${e.salesforceLogin.active ? "" : " (off)"}` : "No login"}</Field>
              <Field label="Dashboard">
                {e.dashboard ? (
                  <span>{e.dashboard.email} · <span className="capitalize">{e.dashboard.role}</span>{e.dashboard.active ? "" : " (off)"}{me?.role === "owner" ? <> · <Link href="/users" className="text-primary hover:underline">access</Link></> : null}</span>
                ) : "No dashboard login"}
              </Field>
            </dl>
            {canEdit ? (
              <div className="border-t border-border">
                <EmployeeAdmin uid={e.uid} wing={e.wingSet ? e.wing : null} departmentId={e.departmentId} departments={departments}
                  dashboardUserId={e.dashboardUserId} users={users} />
              </div>
            ) : null}
          </Panel>
        </div>

        {e.reports.length ? (
          <Panel title={`Reports to ${e.name.split(" ")[0]} · ${e.reports.length}`} flush>
            <ul className="divide-y divide-border text-sm">
              {e.reports.map((r) => (
                <li key={r.uid} className="flex items-center justify-between px-4 py-2">
                  <Link href={`/employees/staff/${r.uid}`} className="font-medium text-primary hover:underline">{r.name}</Link>
                  <span className="text-xs text-muted-foreground">{r.designation}</span>
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}
