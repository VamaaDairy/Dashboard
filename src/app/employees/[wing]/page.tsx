import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { Plus, Search, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { EmployeeTabs } from "@/components/employees/EmployeeTabs";
import { EmployeeTable } from "@/components/employees/EmployeeTable";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { WINGS, isWingTab, listDepartments, listEmployees, wingCounts } from "@/lib/employees";

export const dynamic = "force-dynamic";

/** Employee Master: one group's employees (Salesforce, Plant, Office, or not placed yet). */
export default async function EmployeeListPage({ params, searchParams }: { params: Promise<{ wing: string }>; searchParams: Promise<{ q?: string; dept?: string }> }) {
  const { wing } = await params;
  if (!isWingTab(wing)) notFound();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const dept = sp.dept && /^\d+$/.test(sp.dept) ? Number(sp.dept) : undefined;
  const me = await userFromToken((await cookies()).get("session")?.value);
  const canEdit = !!me && atLeast(levelFor(me, "employees"), "edit");
  const [counts, rows, departments] = await Promise.all([wingCounts(), listEmployees(wing, q, dept), listDepartments()]);
  const info = WINGS.find((w) => w.key === wing);
  const inThis = departments.filter((d) => d.active && (wing === "unset" || d.wing === wing || d.wing === null));

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-4">
        <PageHeader
          icon={Users}
          title={`Employee Master · ${info?.label ?? "Not set"}`}
          subtitle={info
            ? `${info.about}. Open anyone for their full profile; tick several to move them to another group or department.`
            : "Employees not placed in Salesforce, Plant or Office yet. Tick them and move them to their group."}
          actions={canEdit ? <Link href="/orders/staffs/new" className={buttonVariants({ variant: "primary" })}><Plus className="size-4" /> Add employee</Link> : null}
        />
        <EmployeeTabs on={wing} counts={counts} />
        <form className="flex flex-wrap items-center gap-2">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <input name="q" defaultValue={q} placeholder="Search name, code, mobile, designation, department"
              className="h-8 w-full rounded-lg border border-input bg-transparent pr-3 pl-8 text-sm focus:border-primary focus:outline-none" />
          </div>
          <select name="dept" defaultValue={dept ?? ""} className="h-8 rounded-lg border border-input bg-background px-2 text-sm" aria-label="Department">
            <option value="">All departments</option>
            {inThis.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <button className="h-8 rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted">Show</button>
          {q || dept ? <Link href={`/employees/${wing}`} className="text-sm text-muted-foreground hover:underline">Clear</Link> : null}
        </form>
        <EmployeeTable rows={rows} departments={departments} canEdit={canEdit} />
      </div>
    </div>
  );
}
