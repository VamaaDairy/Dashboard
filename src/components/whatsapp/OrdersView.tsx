"use client";

import { useState } from "react";
import Link from "next/link";
import { ImageIcon, MapPin, MessageCircle, Search, Star, X } from "lucide-react";
import { askForReview, saveOrderNotes, setOrderStatus, setPaymentStatus } from "@/app/whatsapp/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { ORDER_STATUSES, type OrderStatus, type PaymentStatus } from "@/lib/whatsapp/statuses";
import type { Message, Order, OrderItem } from "@/lib/whatsapp/store";
import { Empty, MediaThumb, OrderStatusBadge, PaymentBadge, getJson, money, phone, usePoll, when } from "./shared";

const FILTERS = [
  { key: "open", label: "Open" },
  { key: "", label: "All" },
  ...ORDER_STATUSES.map((s) => ({ key: s, label: s[0].toUpperCase() + s.slice(1) })),
];

interface Detail {
  order: Order;
  items: OrderItem[];
  media: Message[];
  review: { rating: number; comment: string | null; created_at: string } | null;
  messages: Pick<Message, "id" | "direction" | "sender" | "type" | "body" | "created_at" | "status">[];
}

export function OrdersView({ initialId }: { initialId: number | null }) {
  const [filter, setFilter] = useState("open");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number | null>(initialId);

  const list = usePoll(() => getJson<Order[]>(`/api/whatsapp/orders?status=${filter}&q=${encodeURIComponent(search)}`), [filter, search], 5000);
  const detail = usePoll(
    () => (selected ? getJson<Detail>(`/api/whatsapp/orders/${selected}`) : Promise.resolve(null)),
    [selected],
    5000,
  );

  function open(id: number | null) {
    setSelected(id);
    detail.setData(null);
    window.history.replaceState(null, "", id ? `/whatsapp/orders?o=${id}` : "/whatsapp/orders");
  }

  return (
    <div className="flex h-[calc(100dvh-9rem)] min-h-[520px] overflow-hidden rounded-xl border border-border bg-card">
      <aside className={`${selected ? "hidden lg:flex" : "flex"} w-full flex-col border-r border-border lg:w-[26rem] lg:shrink-0`}>
        <div className="space-y-2 border-b border-border p-3">
          <label className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Order no, name or number" className="h-8 w-full bg-transparent text-sm outline-none" />
          </label>
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.key || "all"}
                onClick={() => setFilter(f.key)}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${filter === f.key ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {list.error ? <p className="p-3 text-xs text-destructive">{list.error}</p> : null}
          {list.data && !list.data.length ? <Empty>No orders here yet.</Empty> : null}
          {list.data?.map((o) => (
            <button
              key={o.id}
              onClick={() => open(o.id)}
              className={`block w-full border-b border-border/60 px-3 py-2.5 text-left hover:bg-muted/60 ${selected === o.id ? "bg-muted" : ""}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{o.order_no}</span>
                <span className="truncate text-xs text-muted-foreground">{o.customer_name || phone(o.wa_id)}</span>
                <span className="num ml-auto text-sm font-semibold">{money(o.total, o.currency)}</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <OrderStatusBadge status={o.status} />
                <PaymentBadge status={o.payment_status} method={o.payment_method} />
                <span className="text-[11px] text-muted-foreground">{o.item_count} item{o.item_count === 1 ? "" : "s"}</span>
                {o.review_rating ? <span className="text-[11px] text-amber-600">{"★".repeat(o.review_rating)}</span> : null}
                <span className="ml-auto text-[11px] text-muted-foreground">{when(o.created_at)}</span>
              </div>
            </button>
          ))}
        </div>
      </aside>

      <section className={`${selected ? "flex" : "hidden lg:flex"} min-w-0 flex-1 flex-col overflow-y-auto`}>
        {!selected ? <Empty>Pick an order.</Empty>
          : !detail.data ? <Empty>{detail.error ?? "Loading…"}</Empty>
          : <OrderDetail key={selected} d={detail.data} onClose={() => open(null)} refresh={() => { detail.refresh(); list.refresh(); }} />}
      </section>
    </div>
  );
}

function OrderDetail({ d, onClose, refresh }: { d: Detail; onClose: () => void; refresh: () => void }) {
  const { order: o, items, media, review } = d;
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState(o.notes ?? "");

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    setError(null);
    const r = await fn();
    if (!r.ok) setError(r.error ?? "Failed");
    setBusy(false);
    refresh();
  }
  const status = (s: OrderStatus) => run(() => setOrderStatus(o.id, s, notify));
  const pay = (s: PaymentStatus) => run(() => setPaymentStatus(o.id, s, notify));

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* header */}
      <div className="flex flex-wrap items-start gap-3">
        <div>
          <h2 className="text-lg font-semibold">{o.order_no}</h2>
          <p className="text-xs text-muted-foreground">
            {new Date(o.created_at).toLocaleString("en-IN")} · {o.source === "catalog" ? "from catalog cart" : "via chat"}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link href={`/whatsapp/chats?c=${o.wa_id}`} className={buttonVariants({ size: "sm", variant: "outline" })}>
            <MessageCircle /> Open chat
          </Link>
          <Button size="icon-sm" variant="ghost" onClick={onClose} className="lg:hidden" aria-label="Close"><X /></Button>
        </div>
      </div>

      {error ? <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}

      {/* status */}
      <div className="rounded-xl border border-border p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Order status</h3>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
            Message the customer about changes
          </label>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ORDER_STATUSES.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={o.status === s ? "secondary" : "outline"}
              disabled={busy || o.status === s}
              onClick={() => status(s)}
              className={`capitalize ${o.status === s ? "ring-2 ring-ring/40" : ""}`}
            >
              {s}
            </Button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Marking it delivered also asks the customer for a star rating.</p>
      </div>

      {/* payment */}
      <div className="rounded-xl border border-border p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">Payment</h3>
          <PaymentBadge status={o.payment_status} method={o.payment_method} />
          <span className="text-xs text-muted-foreground">
            {o.payment_method === "cod" ? "Cash on delivery" : o.payment_method === "link" ? "Razorpay link" : "UPI"}
            {o.payment_ref ? ` · ref ${o.payment_ref}` : ""}
          </span>
          {o.payment_link ? <a href={o.payment_link} target="_blank" rel="noreferrer" className="text-xs text-primary underline">payment link</a> : null}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" disabled={busy || o.payment_status === "paid"} onClick={() => pay("paid")} className="bg-emerald-600 text-white hover:bg-emerald-700">Mark paid</Button>
          <Button size="sm" variant="outline" disabled={busy || o.payment_status === "unpaid"} onClick={() => pay("unpaid")}>Mark unpaid</Button>
          <Button size="sm" variant="outline" disabled={busy || o.payment_status === "refunded"} onClick={() => pay("refunded")}>Refunded</Button>
        </div>
        {o.payment_status === "verifying" ? (
          <p className="mt-2 text-xs text-warning-foreground">The customer sent a screenshot - check it under Photos below, then mark paid.</p>
        ) : null}
      </div>

      {/* items */}
      <div className="rounded-xl border border-border">
        <h3 className="border-b border-border px-4 py-2.5 text-sm font-semibold">Items</h3>
        <div className="divide-y divide-border">
          {items.map((i) => (
            <div key={i.retailer_id} className="flex items-center gap-3 px-4 py-2.5">
              {i.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- catalog image from Meta's CDN
                <img src={i.image_url} alt="" className="h-12 w-12 rounded-md object-cover" />
              ) : <span className="flex h-12 w-12 items-center justify-center rounded-md bg-muted"><ImageIcon className="h-4 w-4 text-muted-foreground" /></span>}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{i.name}</div>
                <div className="text-xs text-muted-foreground">{i.retailer_id} · {money(i.unit_price, o.currency)} × {i.qty}</div>
              </div>
              <span className="num text-sm font-semibold">{money(i.line_total, o.currency)}</span>
            </div>
          ))}
        </div>
        <div className="space-y-0.5 border-t border-border px-4 py-2.5 text-sm">
          <Row label="Subtotal" value={money(o.subtotal, o.currency)} />
          <Row label="Delivery" value={money(o.delivery_fee, o.currency)} />
          <Row label="Total" value={money(o.total, o.currency)} bold />
        </div>
      </div>

      {/* customer */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border p-4">
          <h3 className="mb-2 text-sm font-semibold">Customer</h3>
          <p className="text-sm">{o.delivery_name || o.customer_name || "—"}</p>
          <p className="text-sm text-muted-foreground">{phone(o.wa_id)}</p>
          {o.delivery_address ? <p className="mt-2 flex gap-1.5 text-sm"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />{o.delivery_address}</p> : null}
        </div>
        <div className="rounded-xl border border-border p-4">
          <h3 className="mb-2 text-sm font-semibold">Notes</h3>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notes !== (o.notes ?? "") && run(() => saveOrderNotes(o.id, notes))}
            rows={3}
            placeholder="Internal notes (saved when you click away)"
            className="w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-ring"
          />
        </div>
      </div>

      {/* photos */}
      <div className="rounded-xl border border-border p-4">
        <h3 className="mb-3 text-sm font-semibold">Photos &amp; files <span className="font-normal text-muted-foreground">({media.length})</span></h3>
        {media.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {media.map((m) => (
              <figure key={m.id} className="space-y-1">
                <MediaThumb id={m.media_id!} mime={m.media_mime} className="aspect-square w-full" />
                <figcaption className="text-[11px] text-muted-foreground">
                  {m.direction === "in" ? "From customer" : "Sent by you"} · {when(m.created_at)}
                  {m.body ? <span className="block truncate text-foreground">{m.body}</span> : null}
                </figcaption>
              </figure>
            ))}
          </div>
        ) : <p className="text-sm text-muted-foreground">Photos the customer sends while this order is open (payment screenshots, references) appear here.</p>}
      </div>

      {/* review */}
      <div className="rounded-xl border border-border p-4">
        <div className="mb-2 flex items-center gap-2">
          <h3 className="text-sm font-semibold">Review</h3>
          <Button size="xs" variant="outline" className="ml-auto" disabled={busy} onClick={() => run(() => askForReview(o.id))}>
            <Star /> Ask for a review
          </Button>
        </div>
        {review ? (
          <div>
            <div className="text-amber-500">{"★".repeat(review.rating)}<span className="text-muted-foreground/40">{"★".repeat(5 - review.rating)}</span></div>
            {review.comment ? <p className="mt-1 text-sm">&ldquo;{review.comment}&rdquo;</p> : null}
          </div>
        ) : <p className="text-sm text-muted-foreground">No review yet.</p>}
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : "text-muted-foreground"}`}>
      <span>{label}</span><span className="num">{value}</span>
    </div>
  );
}
