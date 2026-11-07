import Link from "next/link";
import { cookies } from "next/headers";
import { Bell, Bike, CalendarClock, ExternalLink, GalleryHorizontal, MapPin, Route, Search, Store, UserX, Repeat } from "lucide-react";
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

/**
 * D2C orders: every home-delivery order from the Gaia app and the online shop (one table, shop_order).
 * This is the only D2C orders list; /app-orders/d2c redirects here, and each order opens its detail page.
 */
export default async function ShopOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; kind?: string; q?: string }> }) {
  const { status, kind: k, q: rawQ } = await searchParams;
  const kind = k === "regular" || k === "subscription" ? k : undefined;
  const q = rawQ?.trim() || undefined;
  const href = (st: string, kd: string) => {
    const p = new URLSearchParams(); if (st) p.set("status", st); if (kd) p.set("kind", kd); if (q) p.set("q", q);
    return p.size ? `/shop-orders?${p}` : "/shop-orders";
  };
  const filter = status && status in STATUS_LABEL ? status : undefined;
  const [orders, riders, me] = await Promise.all([listOrders(filter, kind, q), query<{ id: number; name: string }>(`select id, name from shop_rider where active and kind = 'delivery' order by name`), userFromToken((await cookies()).get("session")?.value)]);
  const canEdit = !!me && atLeast(levelFor(me, "shop"), "edit");

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-4">
        <PageHeader
          icon={Store}
          title="D2C orders"
          subtitle="Every home-delivery order from the Gaia app and the online shop."
          actions={
            <div className="flex gap-2">
            <Link href="/shop-orders/riders" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted">
              <Bike className="h-4 w-4" /> Riders
            </Link>
            <Link href="/shop-orders/subscriptions" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted">
              <CalendarClock className="h-4 w-4" /> Subscriptions
            </Link>
            <Link href="/shop-orders/autopay" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted">
              <Repeat className="h-4 w-4" /> Autopay
            </Link>
            <Link href="/shop-orders/banners" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted">
              <GalleryHorizontal className="h-4 w-4" /> Banners
            </Link>
            <Link href="/shop-orders/live" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted">
              <MapPin className="h-4 w-4" /> Live map
            </Link>
            <Link href="/shop-orders/notifications" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted">
              <Bell className="h-4 w-4" /> Notifications
            </Link>
            <Link href="/shop-orders/deletion-requests" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted">
              <UserX className="h-4 w-4" /> Deletion requests
            </Link>
            <Link href="/shop" target="_blank" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted">
              <ExternalLink className="h-4 w-4" /> Open shop
            </Link>
            </div>
          }
        />
        <form action="/shop-orders" className="flex max-w-md items-center gap-2">
          {filter ? <input type="hidden" name="status" value={filter} /> : null}
          {kind ? <input type="hidden" name="kind" value={kind} /> : null}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input name="q" defaultValue={q ?? ""} placeholder="Search order no, name, phone, address"
              className="h-8 w-full rounded-lg border border-input bg-transparent pl-8 pr-3 text-sm focus:border-primary focus:outline-none" />
          </div>
          <button type="submit" className="inline-flex h-8 items-center rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted">Search</button>
          {q ? <Link href={href(filter ?? "", kind ?? "")} className="text-sm text-muted-foreground hover:underline">Clear</Link> : null}
        </form>
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
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs"><Link href={`/app-orders/d2c/${o.id}`} className="font-semibold text-primary hover:underline">{o.order_no}</Link>{o.subscription_day ? <div className="mt-0.5 w-fit rounded bg-blue-100 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-blue-700">SUBSCRIPTION</div> : null}</td>
                  <td className="whitespace-nowrap px-3 py-2">{when(o.created_at)}</td>
                  <td className="px-3 py-2"><div className="font-medium">{o.name}</div><div className="font-mono text-xs text-muted-foreground">{o.phone}</div></td>
                  <td className="min-w-56 px-3 py-2 text-muted-foreground">{o.address}{o.pincode ? ` - ${o.pincode}` : ""}{o.notes ? <div className="text-xs italic">Note: {o.notes}</div> : null}</td>
                  <td className="min-w-48 px-3 py-2">{o.items.map((i) => `${i.name} × ${i.qty}`).join(", ")}</td>
                  <td className="num whitespace-nowrap px-3 py-2 text-right">{rupees(o.total)}<div className="text-xs text-muted-foreground">{o.payment_method === "online" ? "Online" : "COD"} · {o.payment_status}</div></td>
                  <td className="px-3 py-2">
                    {canEdit ? <AssignSelect orderId={o.id} riderId={o.rider_id} riders={riders} /> : o.rider?.name ?? "-"}
                    {o.lat === null ? <div className="mt-1 text-xs text-amber-600">No map pin</div> : null}
                    {o.rider_id && o.picked_up_at ? (
                      <Link href={`/shop-orders/track/${o.id}`} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                        <Route className="h-3.5 w-3.5" /> {o.status === "out_for_delivery" ? "Track live" : "Route"}
                      </Link>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">{canEdit ? <StatusSelect id={o.id} status={o.status} /> : STATUS_LABEL[o.status] ?? o.status}</td>
                </tr>
              ))}
              {orders.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">{q || filter || kind ? "No orders match." : "No orders yet."}</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
