import Link from "next/link";
import { cookies } from "next/headers";
import { Bike, Building2, CalendarClock, ExternalLink, GalleryHorizontal, MapPin, Store } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatusSelect } from "@/components/shop/StatusSelect";
import { AssignSelect } from "@/components/shop/AssignSelect";
import { query } from "@/lib/db";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { listOrders } from "@/lib/shop/orders";
import { rupees, STATUS_LABEL } from "@/lib/shop/pricing";

export const dynamic = "force-dynamic";

const when = (d: Date) =>
  new Date(d).toLocaleString("en-GB", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export default async function ShopOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; kind?: string }> }) {
  const { status, kind: k } = await searchParams;
  const kind = k === "regular" || k === "subscription" ? k : undefined;
  const href = (st: string, kd: string) => { const q = new URLSearchParams(); if (st) q.set("status", st); if (kd) q.set("kind", kd); return q.size ? `/shop-orders?${q}` : "/shop-orders"; };
  const filter = status && status in STATUS_LABEL ? status : undefined;
  const [orders, riders, me] = await Promise.all([listOrders(filter, kind), query<{ id: number; name: string }>(`select id, name from shop_rider where active order by name`), userFromToken((await cookies()).get("session")?.value)]);
  const canEdit = !!me && atLeast(levelFor(me, "shop"), "edit");

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-4">
        <PageHeader
          icon={Store}
          title="Shop orders"
          subtitle="Orders placed on the Gaia online shop."
          actions={
            <div className="flex gap-2">
            <Link href="/shop-orders/riders" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted">
              <Bike className="h-4 w-4" /> Riders
            </Link>
            <Link href="/shop-orders/distributors" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted">
              <Building2 className="h-4 w-4" /> Distributor logins
            </Link>
            <Link href="/shop-orders/subscriptions" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted">
              <CalendarClock className="h-4 w-4" /> Subscriptions
            </Link>
            <Link href="/shop-orders/banners" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted">
              <GalleryHorizontal className="h-4 w-4" /> Banners
            </Link>
            <Link href="/shop-orders/live" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted">
              <MapPin className="h-4 w-4" /> Live map
            </Link>
            <Link href="/shop" target="_blank" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted">
              <ExternalLink className="h-4 w-4" /> Open shop
            </Link>
            </div>
          }
        />
        <div className="flex flex-wrap gap-1.5 text-sm">
          {[["", "All orders"], ["regular", "Regular"], ["subscription", "Subscription"]].map(([v, l]) => (
            <Link key={v} href={href(filter ?? "", v)}
              className={`rounded-full border px-3 py-1 ${(kind ?? "") === v ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}>
              {l}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 text-sm">
          {[["", "All"], ...Object.entries(STATUS_LABEL)].map(([v, l]) => (
            <Link key={v} href={href(v, kind ?? "")}
              className={`rounded-full border px-3 py-1 ${(filter ?? "") === v ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}>
              {l}
            </Link>
          ))}
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>
                {["Order", "Placed", "Customer", "Address", "Items", "Total", "Rider", "Status"].map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-2 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-border align-top hover:bg-muted/40">
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{o.order_no}{o.subscription_day ? <div className="mt-0.5 inline-block rounded bg-blue-100 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-blue-700">SUBSCRIPTION</div> : null}</td>
                  <td className="whitespace-nowrap px-3 py-2">{when(o.created_at)}</td>
                  <td className="px-3 py-2"><div className="font-medium">{o.name}</div><div className="font-mono text-xs text-muted-foreground">{o.phone}</div></td>
                  <td className="min-w-56 px-3 py-2 text-muted-foreground">{o.address}{o.pincode ? ` - ${o.pincode}` : ""}{o.notes ? <div className="text-xs italic">Note: {o.notes}</div> : null}</td>
                  <td className="min-w-48 px-3 py-2">{o.items.map((i) => `${i.name} × ${i.qty}`).join(", ")}</td>
                  <td className="num whitespace-nowrap px-3 py-2 text-right">{rupees(o.total)}<div className="text-xs text-muted-foreground">COD · {o.payment_status}</div></td>
                  <td className="px-3 py-2">
                    {canEdit ? <AssignSelect orderId={o.id} riderId={o.rider_id} riders={riders} /> : o.rider?.name ?? "-"}
                    {o.lat === null ? <div className="mt-1 text-xs text-amber-600">No map pin</div> : null}
                  </td>
                  <td className="px-3 py-2">{canEdit ? <StatusSelect id={o.id} status={o.status} /> : STATUS_LABEL[o.status] ?? o.status}</td>
                </tr>
              ))}
              {orders.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">No orders yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
