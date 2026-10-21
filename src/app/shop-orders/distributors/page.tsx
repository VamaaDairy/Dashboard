import Link from "next/link";
import { cookies } from "next/headers";
import { Building2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { AddDistLoginForm, DistLoginActions } from "@/components/shop/DistLoginAdmin";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

interface Row { id: number; kind: string; name: string; code: string | null; phone: string; active: boolean; orders: number }
interface Opt { uid: string; label: string; phone: string | null }

export default async function DistributorLoginsPage() {
  const [logins, distributors, salesmen, me] = await Promise.all([
    query<Row>(`select l.id, l.kind, coalesce(f.name, trim(concat_ws(' ', s.first_name, s.last_name))) as name,
        coalesce(f.firm_code, s.employee_code) as code, l.phone, l.active,
        (select count(*)::int from fp_booking_order b where b.reference like 'Gaia app%' and (b.from_firm_uid = l.firm_uid or b.staff_uid = l.staff_uid)) as orders
      from dist_login l left join fp_firm f on f.uid = l.firm_uid left join fp_staff s on s.uid = l.staff_uid
      order by l.active desc, l.kind, name`),
    query<Opt>(`select f.uid, f.name || ' (' || f.firm_code || ')' as label, f.phone
      from fp_firm f join fp_channel c on c.uid = f.channel_uid
      where f.active = 1 and c.level = 3 and not exists (select 1 from dist_login l where l.firm_uid = f.uid) order by f.name`),
    query<Opt>(`select s.uid, trim(concat_ws(' ', s.first_name, s.last_name)) || coalesce(' (' || s.employee_code || ')', '') as label, s.phone
      from fp_staff s where s.active = 1 and not exists (select 1 from dist_login l where l.staff_uid = s.uid) order by 2`),
    userFromToken((await cookies()).get("session")?.value),
  ]);
  const canEdit = !!me && atLeast(levelFor(me, "shop"), "edit");

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-4">
        <PageHeader
          icon={Building2}
          title="Distributor app logins"
          subtitle="Distributors (and salesmen booking for them) sign in to the Gaia app with their mobile number and PIN. Their orders appear under Primary."
          actions={<Link href="/shop-orders" className="inline-flex h-8 items-center rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted">Shop orders</Link>}
        />
        {canEdit ? <AddDistLoginForm distributors={distributors} salesmen={salesmen} /> : null}
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>{["Name", "Type", "Code", "Mobile", "App orders", "Status", ""].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody>
              {logins.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{r.name}</td>
                  <td className="px-3 py-2 capitalize">{r.kind}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.code}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.phone}</td>
                  <td className="num px-3 py-2">{r.orders}</td>
                  <td className="px-3 py-2">{r.active ? "Active" : "Inactive"}</td>
                  <td className="px-3 py-2">{canEdit ? <DistLoginActions id={r.id} active={r.active} /> : null}</td>
                </tr>
              ))}
              {logins.length === 0 ? <tr><td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">No logins yet. Add one above.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
