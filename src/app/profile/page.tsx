import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { UserCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { userFromToken } from "@/lib/access-server";
import { one } from "@/lib/db";
import { RecoveryEmailForm } from "./RecoveryEmailForm";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const me = await userFromToken((await cookies()).get("session")?.value);
  if (!me) redirect("/login");
  const row = await one<{ recovery_email: string | null }>(`select recovery_email from app_user where id = $1`, [me.id]);

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
      </div>
    </div>
  );
}
