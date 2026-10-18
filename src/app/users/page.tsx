import { UserPlus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { query } from "@/lib/db";
import { cleanAccess } from "@/lib/access";
import { UsersManager, type UserRecord } from "./UsersManager";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const rows = await query<{
    id: string; email: string; name: string; role: string; is_active: boolean; access: unknown;
  }>(`select id, email, name, role, is_active, access from app_user order by created_at`);
  const users: UserRecord[] = rows.map((r) => ({
    id: r.id, email: r.email, name: r.name, role: r.role,
    isActive: r.is_active, access: cleanAccess(r.access),
  }));

  return (
    <div className="flex flex-col flex-1 bg-background p-4 md:p-6 min-h-screen">
      <div className="w-full space-y-5">
        <PageHeader
          icon={UserPlus}
          title="Users"
          subtitle="Add people who can sign in, and choose what each of them can open or change."
        />
        <UsersManager users={users} />
      </div>
    </div>
  );
}
