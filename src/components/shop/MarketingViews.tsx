import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { BadgePercent, GalleryHorizontal, Gift, IndianRupee, Plus, Ticket } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { OfferRowActions } from "@/components/shop/OfferRowActions";
import { OfferForm } from "@/components/shop/OfferForm";
import { BannerActions, BannerForm, type BannerRow } from "@/components/shop/BannerAdmin";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { query } from "@/lib/db";
import { listAllProducts, listProducts } from "@/lib/shop/catalog";
import { allOffers, getOffer, offerStats, ordersWithOffers, type MarketingApp } from "@/lib/shop/offers";
import { describeOffer, isLive, type Offer } from "@/lib/shop/offers-engine";
import { BLANK, canEditShop, offerChoices, offerState, toInput, type OfferState } from "@/lib/shop/offer-page";
import { cn } from "@/lib/utils";

/** Where each app's marketing pages are: the D2C app's, and the Gaia Distributors app's (Distributor & Retail). */
export const PATHS: Record<MarketingApp, { offers: string; banners: string }> = {
  d2c: { offers: "/shop-orders/offers", banners: "/shop-orders/banners" },
  partners: { offers: "/app-orders/marketing/offers", banners: "/app-orders/marketing/banners" },
};

/** The Gaia Distributors app's products (Distributors and Retail lists together), for banners. */
async function partnerProducts() {
  const all = [...(await listAllProducts("distributor")), ...(await listAllProducts("retail"))];
  return [...new Map(all.map((p) => [p.sku, p])).values()];
}


const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const STATE: Record<OfferState, { label: string; cls: string }> = {
  live: { label: "Live", cls: "bg-primary/10 text-primary ring-border-brand" },
  scheduled: { label: "Scheduled", cls: "bg-muted text-muted-foreground ring-border" },
  paused: { label: "Paused", cls: "bg-muted text-muted-foreground ring-foreground/10" },
  ended: { label: "Ended", cls: "bg-muted text-muted-foreground ring-foreground/10" },
  used_up: { label: "Used up", cls: "bg-muted text-foreground ring-border" },
};
const ORDER: OfferState[] = ["live", "scheduled", "used_up", "paused", "ended"];
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" }) : null;
const KIND_ICON = { percent: BadgePercent, flat: IndianRupee, free_item: Gift } as const;

const WHO: Record<string, string> = { distributor: "Distributors", retailer: "Retailers", partners: "Distributors + retailers" };

/** Marketing > Offers: every offer of one app (the D2C app, or the Gaia Distributors app) with its status and use. */
export async function OffersView({ app }: { app: MarketingApp }) {
  const P = PATHS[app];
  const [offers, stats, { products }, canEdit, orders] = await Promise.all([allOffers(app), offerStats(app), offerChoices(app), canEditShop(), ordersWithOffers(app)]);
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
          title={app === "d2c" ? "Offers" : "Distributor & retailer offers"}
          subtitle={app === "d2c"
            ? "Discounts, free items and coupon codes. Each offer shown in the app is a home banner; tapping it adds the offer to the cart. The server prices every order."
            : "Discounts, free items and coupon codes for the Gaia Distributors app - for distributors, retailers or both. They are taken off the order, its invoice, the route-sheet bill and the Tally file."}
          actions={
            <div className="flex gap-2">
              <Link href={P.banners} className="inline-flex h-8 items-center rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted">Banners</Link>
              {canEdit ? (
                <Link href={`${P.offers}/new`} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
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
            {canEdit ? <Link href={`${P.offers}/new`} className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"><Plus className="size-4" /> Create the first offer</Link> : null}
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
                        <Link href={canEdit ? `${P.offers}/${o.id}` : "#"} className="font-semibold hover:underline">{o.title}</Link>
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", STATE[state].cls)}>{STATE[state].label}</span>
                        {app === "partners" && o.audience ? <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">{WHO[o.audience] ?? o.audience}</span> : null}
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
                    <OfferRowActions id={o.id} active={o.active} canEdit={canEdit} base={P.offers} />
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


export async function NewOfferView({ app }: { app: MarketingApp }) {
  const P = PATHS[app];
  if (!(await canEditShop())) redirect(P.offers);
  const { products, categories } = await offerChoices(app);
  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-4">
        <PageHeader icon={BadgePercent} title="New offer" subtitle="Set it up once; the server applies it to every app order that qualifies."
          actions={<Link href={P.offers} className="inline-flex h-8 items-center rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted">All offers</Link>} />
        <OfferForm id={null} initial={app === "d2c" ? BLANK : { ...BLANK, audience: "partners" }} products={products} categories={categories} base={P.offers} />
      </div>
    </div>
  );
}


export async function EditOfferView({ app, id }: { app: MarketingApp; id: number }) {
  const P = PATHS[app];
  if (!Number.isInteger(id) || id < 1) notFound();
  if (!(await canEditShop())) redirect(P.offers);
  const [offer, { products, categories }] = await Promise.all([getOffer(id), offerChoices(app)]);
  // an offer is edited in its own app's section
  if (!offer || ((offer.audience ?? "d2c") === "d2c") !== (app === "d2c")) notFound();
  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-4">
        <PageHeader icon={BadgePercent} title={offer.title} subtitle="Changes apply to new orders straight away; placed orders keep what they got."
          actions={<Link href={P.offers} className="inline-flex h-8 items-center rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted">All offers</Link>} />
        <OfferForm id={id} initial={toInput(offer)} products={products} categories={categories} base={P.offers} />
      </div>
    </div>
  );
}


const day = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : null);

/** The home carousel of one app: the D2C app, or the Gaia Distributors app (distributors, retailers or both). */
export async function BannersView({ app }: { app: MarketingApp }) {
  const P = PATHS[app];
  const [banners, products, offers, me] = await Promise.all([
    query<BannerRow>(`select id, title, subtitle, cta, sku_code as sku, category, offer_id as "offerId", bg_color as "bgColor", priority, active, audience,
        to_char(starts_at, 'YYYY-MM-DD') as "startsAt", to_char(ends_at, 'YYYY-MM-DD') as "endsAt",
        case when image is null then null else '/api/shop/banners/' || id || '/image?v=' || extract(epoch from updated_at)::bigint end as image
      from shop_banner where ${app === "d2c" ? "audience = 'd2c'" : "audience <> 'd2c'"} order by active desc, priority desc, id`),
    app === "d2c" ? listProducts() : partnerProducts(),
    allOffers(app),
    userFromToken((await cookies()).get("session")?.value),
  ]);
  const canEdit = !!me && atLeast(levelFor(me, "shop"), "edit");
  const options = products.map((p) => ({ sku: p.sku, name: p.name, image: p.image }));
  const nameOf = new Map(products.map((p) => [p.sku, p.name]));
  const now = new Date();
  const targets = {
    products: options,
    categories: [...new Set(products.map((p) => p.category))],
    offers: offers.map((o) => ({ id: o.id, title: o.title, badge: o.badge, live: isLive(o, now) })),
    app,
  };
  const offerName = new Map(offers.map((o) => [o.id, o.title]));
  const today = new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
  const stateOf = (b: BannerRow) =>
    !b.active ? ["Off", "bg-muted text-muted-foreground ring-foreground/10"]
      : b.endsAt && b.endsAt < today ? ["Ended", "bg-muted text-muted-foreground ring-foreground/10"]
        : b.startsAt && b.startsAt > today ? ["Scheduled", "bg-muted text-muted-foreground ring-border"]
          : ["Live", "bg-primary/10 text-primary ring-border-brand"];

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-4">
        <PageHeader
          icon={GalleryHorizontal}
          title={app === "d2c" ? "Banners" : "Distributor & retailer banners"}
          subtitle={app === "d2c"
            ? "The carousel at the top of the Gaia app. Highest priority shows first; the app picks up changes within a minute."
            : "The carousel at the top of the Gaia Distributors app - for distributors, retailers or both. Highest priority shows first."}
          actions={<Link href={P.offers} className="inline-flex h-8 items-center rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted">Offers</Link>}
        />
        {canEdit ? <BannerForm targets={targets} /> : null}
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>{["Banner", ...(app === "partners" ? ["For"] : []), "Opens", "Shows", "Priority", "Status", ""].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody>
              {banners.map((b) => (
                <tr key={b.id} className={`border-t border-border ${b.active ? "" : "opacity-60"}`}>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-3">
                      {b.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={b.image} alt="" className="h-12 w-24 rounded-md object-cover" />
                      ) : (
                        <div className="h-12 w-24 shrink-0 rounded-md" style={{ background: b.bgColor }} />
                      )}
                      <div className="min-w-0">
                        <div className="font-medium">{b.title || <span className="text-muted-foreground">Poster only</span>}</div>
                        {b.subtitle ? <div className="truncate text-xs text-muted-foreground">{b.subtitle}</div> : null}
                      </div>
                    </div>
                  </td>
                  {app === "partners" ? <td className="whitespace-nowrap px-3 py-2">{b.audience === "distributor" ? "Distributors" : b.audience === "retailer" ? "Retailers" : "Both"}</td> : null}
                  <td className="px-3 py-2 text-muted-foreground">
                    {b.offerId ? <>Offer: <span className="text-foreground">{offerName.get(b.offerId) ?? `#${b.offerId}`}</span></>
                      : b.category ? <>Category: <span className="text-foreground">{b.category}</span></>
                        : b.sku ? nameOf.get(b.sku) ?? b.sku : "-"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {b.startsAt || b.endsAt ? `${day(b.startsAt) ?? "now"} - ${day(b.endsAt) ?? "always"}` : "Always"}
                  </td>
                  <td className="num px-3 py-2">{b.priority}</td>
                  <td className="px-3 py-2">{(() => { const [l, c] = stateOf(b); return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", c)}>{l}</span>; })()}</td>
                  <td className="px-3 py-2">{canEdit ? <BannerActions banner={b} targets={targets} /> : null}</td>
                </tr>
              ))}
              {banners.length === 0 ? <tr><td colSpan={app === "partners" ? 7 : 6} className="px-3 py-10 text-center text-muted-foreground">No banners yet. Add one above.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
