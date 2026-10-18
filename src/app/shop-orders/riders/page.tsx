import Link from "next/link";
import { cookies } from "next/headers";
import { Bike } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { AddRiderForm, RiderActions } from "@/components/shop/RiderAdmin";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

interface Row { id: number; name: string; phone: string; active: boolean; location_at: Date | null; open_orders: number; delivered: number }

const ago = (d: Date | null) => {
  if (!d) return "never";
  const m = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
};

export default async function RidersPage() {
  const [riders, me] = await Promise.all([
    query<Row>(`select r.id, r.name, r.phone, r.active, r.location_at,
        (select count(*)::int from shop_order o where o.rider_id = r.id and o.status in ('confirmed', 'out_for_delivery')) as open_orders,
        (select count(*)::int from shop_order o where o.rider_id = r.id and o.status = 'delivered') as delivered
      from shop_rider r order by r.active desc, r.name`),
    userFromToken((await cookies()).get("session")?.value),
  ]);
  const canEdit = !!me && atLeast(levelFor(me, "shop"), "edit");

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-4">
        <PageHeader
          icon={Bike}
          title="Delivery riders"
          subtitle="Riders sign in to the Gaia app with their mobile number and PIN."
          actions={<Link href="/shop-orders/live" className="inline-flex h-8 items-center rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted">Live map</Link>}
        />
        {canEdit ? <AddRiderForm /> : null}
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>{["Rider", "Mobile", "To deliver", "Delivered", "Last seen", "Status", ""].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody>
              {riders.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{r.name}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.phone}</td>
                  <td className="num px-3 py-2">{r.open_orders}</td>
                  <td className="num px-3 py-2">{r.delivered}</td>
                  <td className="px-3 py-2 text-muted-foreground">{ago(r.location_at)}</td>
                  <td className="px-3 py-2">{r.active ? "Active" : "Inactive"}</td>
                  <td className="px-3 py-2">{canEdit ? <RiderActions id={r.id} active={r.active} /> : null}</td>
                </tr>
              ))}
              {riders.length === 0 ? <tr><td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">No riders yet. Add one above.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
