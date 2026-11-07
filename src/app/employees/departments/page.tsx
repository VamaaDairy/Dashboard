import { cookies } from "next/headers";
import { Building2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmployeeTabs } from "@/components/employees/EmployeeTabs";
import { DepartmentEditor } from "@/components/employees/DepartmentEditor";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { listDepartments, wingCounts } from "@/lib/employees";

export const dynamic = "force-dynamic";

/** The departments employees belong to, each under Salesforce, Plant or Office. */
export default async function DepartmentsPage() {
  const me = await userFromToken((await cookies()).get("session")?.value);
  const canEdit = !!me && atLeast(levelFor(me, "employees"), "edit");
  const [counts, departments] = await Promise.all([wingCounts(), listDepartments()]);
  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <PageHeader icon={Building2} title="Employee Master · Departments"
          subtitle="Every employee belongs to one department, and each department to Salesforce, Plant or Office. Switching one off keeps its people but hides it from new choices." />
        <EmployeeTabs on="departments" counts={counts} />
        <DepartmentEditor departments={departments} canEdit={canEdit} />
      </div>
    </div>
  );
}
