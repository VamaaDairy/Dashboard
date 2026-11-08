import Link from "next/link";
import { cookies } from "next/headers";
import { ChevronDown, Download } from "lucide-react";
import { OrderFilters } from "@/components/shop/OrderFilters";
import { OrdersTable, type OrderRow } from "@/components/shop/OrdersTable";
import { query } from "@/lib/db";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { DATE_RANGES, PAGE_SIZE, boardFilter, orderBoard, recentPincodes, today, trackingOf, type BoardParams } from "@/lib/shop/order-board";
import { STATUS_LABEL } from "@/lib/shop/pricing";
import { labelOf, productLabels } from "@/lib/products/names";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const placed = (d: Date) => new Date(d).toLocaleString("en-GB", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const dayOnly = (d: string | Date) => new Date(d).toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const TABS: Array<[string, string]> = [["", "All"], ["placed", "New"], ["confirmed", "Confirmed"], ["out_for_delivery", "Out for delivery"], ["delivered", "Delivered"], ["cancelled", "Cancelled"], ["awaiting_payment", "Awaiting payment"]];
const MORE: Array<[string, string]> = [
  ["/shop-orders/riders", "Riders"], ["/shop-orders/subscriptions", "Subscriptions"], ["/shop-orders/autopay", "Autopay"], ["/shop-orders/live", "Live map"],
  ["/shop-orders/banners", "Banners"], ["/shop-orders/notifications", "Notifications"], ["/shop-orders/deletion-requests", "Deletion requests"],
];

/**
 * D2C orders: every home-delivery order from the Gaia app and the online shop (shop_order). Today's figures on
 * top, then the orders by status with filters; a row opens the order's page (with its route map).
 */
export default async function ShopOrdersPage({ searchParams }: { searchParams: Promise<BoardParams> }) {
  const sp = await searchParams;
  const f = boardFilter(sp);
  const [board, t, riders, pins, me, labels] = await Promise.all([
    orderBoard(f),
    today(),
    query<{ id: number; name: string }>(`select id, name from shop_rider where active and kind = 'delivery' order by name`),
    recentPincodes(),
    userFromToken((await cookies()).get("session")?.value),
    productLabels(),
  ]);
  const canEdit = !!me && atLeast(levelFor(me, "shop"), "edit");
  const now = new Date();

  const rows: OrderRow[] = board.rows.map((o) => {
    const tr = trackingOf(o, now);
    return {
      id: o.id,
      orderNo: o.order_no,
      placed: placed(o.created_at),
      type: o.subscription_day ? `Subscription · ${dayOnly(o.subscription_day)}` : "Regular",
      subscription: !!o.subscription_day,
      name: o.name,
      phone: o.phone,
      nth: o.nth,
      address: o.address,
      pincode: o.pincode,
      noPin: o.lat === null,
      note: o.notes,
      items: o.items.map((i) => { const l = labelOf(labels, i.sku_code, i.name, i.image_url); return { name: l.name, image: l.image, qty: i.qty }; }),
      qty: o.items.reduce((a, i) => a + i.qty, 0),
      subtotal: Number(o.subtotal),
      deliveryFee: Number(o.delivery_fee),
      total: Number(o.total),
      payMethod: o.payment_method === "cod" ? "Cash on delivery" : o.payment_method === "autopay" ? "Autopay" : "Online",
      paid: o.payment_status === "paid"
        ? { label: o.payment_method === "cod" ? "Collected" : "Paid", tone: "good" }
        : o.payment_status === "refunded" ? { label: "Refunded", tone: "bad" }
        : o.status === "cancelled" ? { label: "Not paid", tone: "bad" }
        : { label: o.payment_method === "cod" ? "To collect" : "Pending", tone: "wait" },
      status: o.status,
      statusLabel: o.status === "placed" ? "New" : STATUS_LABEL[o.status] ?? o.status,
      tracking: { ...tr, route: !!o.picked_up_at },
      rider: o.rider?.name ?? null,
      stop: o.delivery_seq ? `stop ${o.delivery_seq}` : null,
    };
  });

  const link = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) p.set(k, String(v));
    return p.size ? `/shop-orders?${p}` : "/shop-orders";
  };
  const exportHref = `/shop-orders/export?${new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "page") as Array<[string, string]>)}`;
  const first = board.total ? (f.page - 1) * PAGE_SIZE + 1 : 0;
  const last = Math.min(board.total, f.page * PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(board.total / PAGE_SIZE));

  return (
    <div className="flex flex-1 flex-col bg-background px-4 pt-6 pb-6 md:px-8">
      <div className="w-full">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-foreground">D2C orders</h1>
            <p className="mt-1 text-[13px] text-foreground/75">Every home-delivery order from the Gaia app and the online shop.</p>
          </div>
          <div className="flex gap-2">
            <a href={exportHref} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-foreground/15 bg-card px-3 text-[13px] font-medium text-foreground hover:bg-foreground/[0.04]">
              <Download className="size-4" /> Export CSV
            </a>
            <details className="relative">
              <summary className="inline-flex h-8 cursor-pointer list-none items-center gap-1 rounded-lg border border-foreground/15 bg-card px-3 text-[13px] font-medium text-foreground hover:bg-foreground/[0.04]">
                More <ChevronDown className="size-4" />
              </summary>
              <div className="absolute right-0 z-30 mt-1 w-52 rounded-lg border border-foreground/15 bg-popover p-1 shadow-lg">
                {MORE.map(([h, l]) => <Link key={h} href={h} className="block rounded-md px-3 py-1.5 text-[13px] text-foreground hover:bg-foreground/[0.05]">{l}</Link>)}
                <a href="/shop" target="_blank" rel="noreferrer" className="block rounded-md px-3 py-1.5 text-[13px] text-foreground hover:bg-foreground/[0.05]">Open the online shop</a>
              </div>
            </details>
          </div>
        </div>

        {/* today, whatever the filters */}
        <div className="mt-6 grid grid-cols-2 gap-x-10 gap-y-4 md:flex md:flex-wrap">
          {[
            { l: "Orders today", v: String(t.orders), n: `${t.subscription} subscription · ${t.orders - t.subscription} regular` },
            { l: "Order value today", v: inr(t.value), n: t.orders ? `about ${inr(t.value / t.orders)} per order` : "no orders yet" },
            { l: "To deliver", v: String(t.toDeliver), n: t.unassigned ? `${t.unassigned} without a rider` : "all have a rider", warn: t.unassigned > 0, href: "/shop-orders?rider=none" },
            { l: "Cash to collect", v: inr(t.cashToCollect), n: `${t.codOut} cash orders out now`, href: "/shop-orders?pay=cod" },
            { l: "Awaiting payment", v: String(t.awaitingPayment), n: "online orders not paid yet", warn: t.awaitingPayment > 0, href: "/shop-orders?status=awaiting_payment" },
          ].map((k) => {
            const body = (
              <>
                <div className="text-[12px] font-medium text-foreground/75">{k.l}</div>
                <div className={cn("mt-1 text-[20px] font-semibold tracking-tight tabular-nums", k.warn ? "text-amber-700" : "text-foreground")}>{k.v}</div>
                <div className="mt-0.5 truncate text-[12px] text-foreground/75">{k.n}</div>
              </>
            );
            return k.href
              ? <Link key={k.l} href={k.href} className="min-w-0 rounded-md hover:opacity-80">{body}</Link>
              : <div key={k.l} className="min-w-0">{body}</div>;
          })}
        </div>

        <div className="mt-7 overflow-hidden rounded-xl border border-foreground/10 bg-card">
          <nav className="flex gap-5 overflow-x-auto border-b border-foreground/10 px-4" aria-label="Order status">
            {TABS.map(([v, l]) => {
              const on = (f.status ?? "") === v;
              const n = v ? board.counts[v] ?? 0 : board.all;
              return (
                <Link key={v} href={link({ status: v || undefined, page: undefined })} aria-current={on ? "page" : undefined}
                  className={cn("-mb-px flex shrink-0 items-center gap-1.5 border-b-2 py-3 text-[13px]", on ? "border-foreground font-semibold text-foreground" : "border-transparent text-foreground/75 hover:text-foreground")}>
                  {l}
                  <span className="text-[12px] font-normal tabular-nums text-foreground/70">{n.toLocaleString("en-IN")}</span>
                </Link>
              );
            })}
          </nav>
          <OrderFilters ranges={DATE_RANGES} riders={riders} pins={pins} />
          <OrdersTable
            rows={rows}
            riders={riders}
            canEdit={canEdit}
            footer={
              <>
                <span className="tabular-nums">{board.total ? `Showing ${first}–${last} of ${board.total.toLocaleString("en-IN")}` : "No orders"} · value {inr(board.value)}</span>
                <span className="flex items-center gap-3">
                  {f.page > 1 ? <Link href={link({ page: String(f.page - 1) })} className="font-medium text-foreground hover:underline">‹ Previous</Link> : <span className="opacity-50">‹ Previous</span>}
                  <span className="tabular-nums">Page {f.page} of {pages}</span>
                  {f.page < pages ? <Link href={link({ page: String(f.page + 1) })} className="font-medium text-foreground hover:underline">Next ›</Link> : <span className="opacity-50">Next ›</span>}
                </span>
              </>
            }
          />
        </div>
      </div>
    </div>
  );
}
