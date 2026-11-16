import { UserPlus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { query } from "@/lib/db";
import { cleanAccess } from "@/lib/access";
import { UsersManager, type DepartmentOption, type UserRecord } from "./UsersManager";
import { ApiKeys } from "./ApiKeys";
import { listApiKeys } from "@/lib/api/keys";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const [rows, departments, keys] = await Promise.all([
    query<{
      id: string; email: string; name: string; role: string; is_active: boolean; access: unknown;
      department_id: number | null; via_employee: number | null; employee: string | null; mobile: string | null;
    }>(
      `select u.id, u.email, u.name, u.role, u.is_active, u.access, u.department_id, em.department_id as via_employee,
              nullif(trim(s.first_name || ' ' || coalesce(s.last_name, '')), '') as employee, u.mobile
         from app_user u left join emp_master em on em.app_user_id = u.id left join fp_staff s on s.uid = em.staff_uid
        order by u.created_at`,
    ),
    query<{ id: number; name: string; active: boolean; access: unknown }>(`select id, name, active, access from department order by active desc, sort, name`),
    listApiKeys(),
  ]);
  const users: UserRecord[] = rows.map((r) => ({
    id: r.id, email: r.email, name: r.name, role: r.role,
    departmentId: r.department_id, employeeDepartmentId: r.via_employee, employee: r.employee, mobile: r.mobile ?? "",
    isActive: r.is_active, access: cleanAccess(r.access),
  }));
  const depts: DepartmentOption[] = departments.map((d) => ({ id: d.id, name: d.name, active: d.active, access: cleanAccess(d.access) }));

  return (
    <div className="flex flex-col flex-1 bg-background p-4 md:p-6 min-h-screen">
      <div className="w-full space-y-5">
        <PageHeader
          icon={UserPlus}
          title="Users"
          subtitle="Add people who can sign in. What they can open comes from their department; give a person more only where they need it."
        />
        <UsersManager users={users} departments={depts} />
        <ApiKeys
          keys={keys.map((k) => ({ ...k, createdAt: new Date(k.createdAt).toISOString(), lastUsedAt: k.lastUsedAt && new Date(k.lastUsedAt).toISOString(), revokedAt: k.revokedAt && new Date(k.revokedAt).toISOString() }))}
          users={users.filter((u) => u.isActive).map((u) => ({ id: u.id, name: u.name || u.email, role: u.role }))}
        />
      </div>
    </div>
  );
}
