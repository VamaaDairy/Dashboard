import Link from "next/link";
import { cookies } from "next/headers";
import { GalleryHorizontal } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { BannerActions, BannerForm, type BannerRow } from "@/components/shop/BannerAdmin";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { query } from "@/lib/db";
import { listProducts } from "@/lib/shop/catalog";

export const dynamic = "force-dynamic";

const day = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : null);

export default async function BannersPage() {
  const [banners, products, me] = await Promise.all([
    query<BannerRow>(`select id, title, subtitle, cta, sku_code as sku, bg_color as "bgColor", priority, active,
        to_char(starts_at, 'YYYY-MM-DD') as "startsAt", to_char(ends_at, 'YYYY-MM-DD') as "endsAt",
        case when image is null then null else '/api/shop/banners/' || id || '/image?v=' || extract(epoch from updated_at)::bigint end as image
      from shop_banner order by active desc, priority desc, id`),
    listProducts(),
    userFromToken((await cookies()).get("session")?.value),
  ]);
  const canEdit = !!me && atLeast(levelFor(me, "shop"), "edit");
  const options = products.map((p) => ({ sku: p.sku, name: p.name, image: p.image }));
  const nameOf = new Map(products.map((p) => [p.sku, p.name]));

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-4">
        <PageHeader
          icon={GalleryHorizontal}
          title="App banners"
          subtitle="The carousel at the top of the Gaia app. Highest priority shows first; the app picks up changes within a minute."
          actions={<Link href="/shop-orders" className="inline-flex h-8 items-center rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted">Shop orders</Link>}
        />
        {canEdit ? <BannerForm products={options} /> : null}
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
                  <td className="px-3 py-2 text-muted-foreground">{b.sku ? nameOf.get(b.sku) ?? b.sku : "-"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {b.startsAt || b.endsAt ? `${day(b.startsAt) ?? "now"} - ${day(b.endsAt) ?? "always"}` : "Always"}
                  </td>
                  <td className="num px-3 py-2">{b.priority}</td>
                  <td className="px-3 py-2">{b.active ? "On" : "Off"}</td>
                  <td className="px-3 py-2">{canEdit ? <BannerActions banner={b} products={options} /> : null}</td>
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
