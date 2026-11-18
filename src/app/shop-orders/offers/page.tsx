import Link from "next/link";
import { BadgePercent, Gift, IndianRupee, Plus, Ticket } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { OfferRowActions } from "@/components/shop/OfferRowActions";
import { allOffers, offerStats, ordersWithOffers } from "@/lib/shop/offers";
import { describeOffer, type Offer } from "@/lib/shop/offers-engine";
import { canEditShop, offerChoices, offerState, type OfferState } from "@/lib/shop/offer-page";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const STATE: Record<OfferState, { label: string; cls: string }> = {
  live: { label: "Live", cls: "bg-primary/10 text-primary ring-border-brand" },
  scheduled: { label: "Scheduled", cls: "bg-info/10 text-info ring-border-info" },
  paused: { label: "Paused", cls: "bg-muted text-muted-foreground ring-foreground/10" },
  ended: { label: "Ended", cls: "bg-muted text-muted-foreground ring-foreground/10" },
  used_up: { label: "Used up", cls: "bg-warning/12 text-warning-foreground ring-border-warning" },
};
const ORDER: OfferState[] = ["live", "scheduled", "used_up", "paused", "ended"];
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" }) : null;
const KIND_ICON = { percent: BadgePercent, flat: IndianRupee, free_item: Gift } as const;

/** Marketing > Offers: every offer with its status and how much it has been used. */
export default async function OffersPage() {
  const [offers, stats, { products }, canEdit, orders] = await Promise.all([allOffers(), offerStats(), offerChoices(), canEditShop(), ordersWithOffers()]);
  const used = new Map(stats.map((s) => [s.offer_id, s]));
  const nameOf = new Map(products.map((p) => [p.sku, p.name]));
  const rows = offers
    .map((o) => ({ o, s: used.get(o.id), state: offerState(o, used.get(o.id)?.orders ?? 0) }))
    .sort((a, b) => ORDER.indexOf(a.state) - ORDER.indexOf(b.state) || b.o.priority - a.o.priority || b.o.id - a.o.id);
  const live = rows.filter((r) => r.state === "live").length;
  const scheduled = rows.filter((r) => r.state === "scheduled").length;
  const given = stats.reduce((s, x) => s + x.discount, 0);
  const freeUnits = stats.reduce((s, x) => s + x.free_units, 0);

  const scopeOf = (o: Offer) =>
    o.appliesTo === "cart" ? "Whole order"
      : o.appliesTo === "categories" ? o.categories.join(", ")
        : o.skus.length <= 2 ? o.skus.map((s) => nameOf.get(s) ?? s).join(", ") : `${nameOf.get(o.skus[0]) ?? o.skus[0]} +${o.skus.length - 1} more`;
  const summaryOf = (o: Offer) => {
    const scope = o.appliesTo === "products" && o.skus.length === 1 ? nameOf.get(o.skus[0]) ?? "item" : o.appliesTo === "categories" ? o.categories.join(" / ") : "the chosen items";
    const gift = o.freeSku ? nameOf.get(o.freeSku) ?? o.freeSku : o.appliesTo === "products" && o.skus.length === 1 ? scope : "of the same item";
    return describeOffer(o, { scope, gift });
  };

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-4">
        <PageHeader
          icon={BadgePercent}
          title="Offers"
          subtitle="Discounts, free items and coupon codes. Each offer shown in the app is a home banner; tapping it adds the offer to the cart. The server prices every order."
          actions={
            <div className="flex gap-2">
              <Link href="/shop-orders/banners" className="inline-flex h-8 items-center rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted">Banners</Link>
              {canEdit ? (
                <Link href="/shop-orders/offers/new" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                  <Plus className="size-4" /> New offer
                </Link>
              ) : null}
            </div>
          }
        />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ["Live now", String(live), scheduled ? `${scheduled} scheduled` : "running in the app"],
            ["Orders with offers", orders.toLocaleString("en-IN"), "not cancelled"],
            ["Discount given", inr(given), "taken off orders"],
            ["Free items given", freeUnits.toLocaleString("en-IN"), "units"],
          ].map(([l, v, sub]) => (
            <div key={l} className="rounded-xl border border-border bg-card px-4 py-3">
              <div className="text-[12px] text-muted-foreground">{l}</div>
              <div className="num mt-0.5 text-xl font-semibold">{v}</div>
              <div className="text-[11px] text-muted-foreground">{sub}</div>
            </div>
          ))}
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-dashed border-border px-6 py-14 text-center">
            <BadgePercent className="size-8 text-muted-foreground" />
            <h2 className="mt-3 text-base font-semibold">No offers yet</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Create a % or ₹ discount, a “buy 2 get 1 free”, a free gift above an order value, or a coupon code for a campaign.
            </p>
            {canEdit ? <Link href="/shop-orders/offers/new" className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"><Plus className="size-4" /> Create the first offer</Link> : null}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {rows.map(({ o, s, state }) => {
              const Icon = KIND_ICON[o.kind];
              const conds = [
                o.minAmount > 0 ? `Min ${inr(o.minAmount)}` : "",
                o.minQty > 0 ? `Min ${o.minQty} qty` : "",
                o.firstOrderOnly ? "First order" : "",
                o.perCustomerLimit ? `${o.perCustomerLimit}× per customer` : "",
                o.totalLimit ? `${s?.orders ?? 0}/${o.totalLimit} used` : "",
                o.showInApp ? "" : "Hidden in app",
              ].filter(Boolean);
              const from = when(o.startsAt), to = when(o.endsAt);
              return (
                <div key={o.id} className={cn("flex flex-col gap-3 border-b border-border p-4 last:border-0 md:flex-row md:items-center", (state === "paused" || state === "ended") && "opacity-70")}>
                  <div className="flex min-w-0 flex-1 gap-3">
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-[18px]" /></span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={canEdit ? `/shop-orders/offers/${o.id}` : "#"} className="font-semibold hover:underline">{o.title}</Link>
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", STATE[state].cls)}>{STATE[state].label}</span>
                        {o.badge ? <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-primary">{o.badge}</span> : null}
                        {o.code ? <span className="inline-flex items-center gap-1 rounded border border-dashed border-foreground/30 px-1.5 py-0.5 font-mono text-[11px]"><Ticket className="size-3" />{o.code}</span> : null}
                      </div>
                      <div className="mt-0.5 text-sm text-muted-foreground">{summaryOf(o)}</div>
                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
                        <span>On: <span className="text-foreground">{scopeOf(o)}</span></span>
                        <span>{from || to ? `${from ?? "Now"} → ${to ?? "no end"}` : "No end date"}</span>
                        {conds.map((c) => <span key={c}>· {c}</span>)}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-4 md:w-[420px] md:justify-end">
                    <div className="text-right text-[12px] leading-tight">
                      <div className="num font-semibold text-foreground">{s?.orders ?? 0} {s?.orders === 1 ? "order" : "orders"}</div>
                      <div className="text-muted-foreground">{s?.discount ? `${inr(s.discount)} off` : s?.free_units ? `${s.free_units} free` : "not used yet"}{s?.last_used ? ` · last ${s.last_used}` : ""}</div>
                    </div>
                    <OfferRowActions id={o.id} active={o.active} canEdit={canEdit} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
