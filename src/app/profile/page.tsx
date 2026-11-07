import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { UserCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { userFromToken } from "@/lib/access-server";
import { one } from "@/lib/db";
import { RecoveryEmailForm } from "./RecoveryEmailForm";
import { Panel } from "@/components/cn/ui";
import { Field } from "@/app/app-orders/parts";
import { employeeProfile, wingLabel } from "@/lib/employees";
import { atLeast, levelFor } from "@/lib/access";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const me = await userFromToken((await cookies()).get("session")?.value);
  if (!me) redirect("/login");
  const [row, staff] = await Promise.all([
    one<{ recovery_email: string | null }>(`select recovery_email from app_user where id = $1`, [me.id]),
    one<{ uid: string }>(`select staff_uid as uid from emp_master where app_user_id = $1`, [me.id]),
  ]);
  // the employee this login is (Employee Master): their job details, read-only here
  const e = staff ? await employeeProfile(staff.uid) : null;
  const day = (d: Date | string | null) =>
    d ? new Date(d).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }) : null;

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full max-w-xl space-y-5">
        <PageHeader icon={UserCircle} title="My profile" subtitle="Your sign-in details and how to recover your account." />
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
          <dl className="mb-5 grid grid-cols-[7rem_1fr] gap-y-2 text-sm">
            <dt className="text-muted-foreground">Name</dt>
            <dd className="text-foreground">{me.name}</dd>
            <dt className="text-muted-foreground">Sign-in user name</dt>
            <dd className="text-foreground">{me.email}</dd>
          </dl>
          <RecoveryEmailForm initial={row?.recovery_email ?? ""} />
        </div>
        <Panel title="As an employee" description={e ? undefined : "This login is not linked to an employee yet. HR links it in Employee Master."} flush>
          {e ? (
            <dl className="divide-y divide-border">
              <Field label="Name">{e.name}</Field>
              <Field label="Group">{wingLabel(e.wing)}</Field>
              <Field label="Department">{e.department}</Field>
              <Field label="Designation">{e.designation}</Field>
              <Field label="Employee code" mono>{e.code}</Field>
              <Field label="Reports to">{e.manager}</Field>
              <Field label="Joined">{day(e.joined)}</Field>
              <Field label="Mobile">{e.phone}</Field>
              <Field label="Employee app">{e.employeeLogin ? `Signed up with ${e.employeeLogin.phone}` : "Not signed up"}</Field>
              {atLeast(levelFor(me, "employees"), "view") ? (
                <Field label="Full profile"><Link href={`/employees/staff/${e.uid}`} className="text-primary hover:underline">Open in Employee Master</Link></Field>
              ) : null}
            </dl>
          ) : null}
        </Panel>
      </div>
    </div>
  );
}
