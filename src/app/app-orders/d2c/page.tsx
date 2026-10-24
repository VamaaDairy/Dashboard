import Link from "next/link";
import { cookies } from "next/headers";
import { Smartphone } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatusSelect } from "@/components/shop/StatusSelect";
import { AssignSelect } from "@/components/shop/AssignSelect";
import { query } from "@/lib/db";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { listOrders } from "@/lib/shop/orders";
import { rupees, STATUS_LABEL } from "@/lib/shop/pricing";
import { summaries } from "@/lib/app-orders";
import { D2cStatus, Filters, KindTabs, when } from "../parts";

export const dynamic = "force-dynamic";

/** D2C: home-delivery orders from customers in the app. */
export default async function D2cOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const { status: st, q } = await searchParams;
  const status = st && st in STATUS_LABEL ? st : undefined;
  const [orders, riders, sum, me] = await Promise.all([
    listOrders(status, undefined, q),
    query<{ id: number; name: string }>(`select id, name from shop_rider where active order by name`),
    summaries(),
    userFromToken((await cookies()).get("session")?.value),
  ]);
  const canEdit = !!me && atLeast(levelFor(me, "shop"), "edit");

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-4">
        <PageHeader icon={Smartphone} title="D2C orders" subtitle="Home-delivery orders from customers in the Gaia app." />
        <KindTabs active="d2c" counts={{ d2c: sum.d2c.open, retailers: sum.retailers.open, distributors: sum.distributors.open }} />
        <Filters
          base="/app-orders/d2c"
          statuses={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))}
          status={status}
          q={q}
          placeholder="Search order no, name, phone, address"
        />

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>
                {["Order", "Placed", "Customer", "Deliver to", "Items", "Total", "Rider", "Status"].map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-2 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-border align-top hover:bg-muted/40">
                  <td className="whitespace-nowrap px-3 py-2">
                    <Link href={`/app-orders/d2c/${o.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">{o.order_no}</Link>
                    {o.subscription_day ? <div className="mt-0.5 w-fit rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">SUBSCRIPTION</div> : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{when(o.created_at)}</td>
                  <td className="px-3 py-2"><div className="font-medium">{o.name}</div><div className="font-mono text-xs text-muted-foreground">{o.phone}</div></td>
                  <td className="min-w-56 max-w-80 px-3 py-2 text-muted-foreground">
                    <div className="line-clamp-2">{o.address}{o.pincode ? ` - ${o.pincode}` : ""}</div>
                    {o.lat === null ? <div className="text-xs text-amber-600">No map pin</div> : null}
                  </td>
                  <td className="min-w-48 px-3 py-2">{o.items.map((i) => `${i.name} × ${i.qty}`).join(", ")}</td>
                  <td className="num whitespace-nowrap px-3 py-2 text-right font-medium">{rupees(o.total)}</td>
                  <td className="px-3 py-2">{canEdit ? <AssignSelect orderId={o.id} riderId={o.rider_id} riders={riders} /> : o.rider?.name ?? "-"}</td>
                  <td className="px-3 py-2">{canEdit ? <StatusSelect id={o.id} status={o.status} /> : <D2cStatus status={o.status} />}</td>
                </tr>
              ))}
              {orders.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">{q || status ? "No orders match." : "No D2C orders yet."}</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
