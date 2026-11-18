import Link from "next/link";
import { cookies } from "next/headers";
import { GalleryHorizontal } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { BannerActions, BannerForm, type BannerRow } from "@/components/shop/BannerAdmin";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { query } from "@/lib/db";
import { listProducts } from "@/lib/shop/catalog";
import { allOffers } from "@/lib/shop/offers";
import { isLive } from "@/lib/shop/offers-engine";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const day = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : null);

export default async function BannersPage() {
  const [banners, products, offers, me] = await Promise.all([
    query<BannerRow>(`select id, title, subtitle, cta, sku_code as sku, category, offer_id as "offerId", bg_color as "bgColor", priority, active,
        to_char(starts_at, 'YYYY-MM-DD') as "startsAt", to_char(ends_at, 'YYYY-MM-DD') as "endsAt",
        case when image is null then null else '/api/shop/banners/' || id || '/image?v=' || extract(epoch from updated_at)::bigint end as image
      from shop_banner order by active desc, priority desc, id`),
    listProducts(),
    allOffers(),
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
  };
  const offerName = new Map(offers.map((o) => [o.id, o.title]));
  const today = new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
  const stateOf = (b: BannerRow) =>
    !b.active ? ["Off", "bg-muted text-muted-foreground ring-foreground/10"]
      : b.endsAt && b.endsAt < today ? ["Ended", "bg-muted text-muted-foreground ring-foreground/10"]
        : b.startsAt && b.startsAt > today ? ["Scheduled", "bg-info/10 text-info ring-border-info"]
          : ["Live", "bg-primary/10 text-primary ring-border-brand"];

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-4">
        <PageHeader
          icon={GalleryHorizontal}
          title="Banners"
          subtitle="The carousel at the top of the Gaia app. Highest priority shows first; the app picks up changes within a minute."
          actions={<Link href="/shop-orders/offers" className="inline-flex h-8 items-center rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted">Offers</Link>}
        />
        {canEdit ? <BannerForm targets={targets} /> : null}
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>{["Banner", "Opens", "Shows", "Priority", "Status", ""].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2 font-semibold">{h}</th>)}</tr>
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
              {banners.length === 0 ? <tr><td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">No banners yet. Add one above.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
