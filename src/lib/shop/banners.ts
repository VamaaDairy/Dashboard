import "server-only";
import { query } from "@/lib/db";

/** A banner as the app sees it. `image` is a path on this server, versioned so a new upload is not served from cache. */
export interface ShopBanner {
  id: number;
  title: string;
  subtitle: string | null;
  cta: string | null;
  sku: string | null;
  /** tapping opens this app category */
  category: string | null;
  /** tapping opens this offer (only while it runs); its badge shows on the card */
  offerId: number | null;
  offerBadge: string | null;
  bgColor: string;
  image: string | null;
}

/** What the carousel shows right now: active, inside its dates (India time), highest priority first. */
export async function liveBanners(): Promise<ShopBanner[]> {
  const rows = await query<{ id: number; title: string; subtitle: string | null; cta: string | null; sku: string | null; category: string | null; offer_id: number | null; offer_badge: string | null; bg_color: string; has_image: boolean; v: string }>(
    `select b.id, b.title, b.subtitle, b.cta, b.sku_code as sku, b.category, f.id as offer_id, f.badge as offer_badge, b.bg_color, b.image is not null as has_image,
            extract(epoch from b.updated_at)::bigint::text as v
       from shop_banner b
       -- an offer banner points at the offer only while it runs (else the banner still shows, opening nothing)
       left join shop_offer f on f.id = b.offer_id and f.active and (f.starts_at is null or f.starts_at <= now()) and (f.ends_at is null or f.ends_at > now())
      where b.active
        and (b.starts_at is null or b.starts_at <= (now() at time zone 'Asia/Kolkata')::date)
        and (b.ends_at is null or b.ends_at >= (now() at time zone 'Asia/Kolkata')::date)
      order by b.priority desc, b.id`,
  );
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    subtitle: r.subtitle,
    cta: r.cta,
    sku: r.sku,
    category: r.category,
    offerId: r.offer_id,
    offerBadge: r.offer_badge,
    bgColor: r.bg_color,
    image: r.has_image ? `/api/shop/banners/${r.id}/image?v=${r.v}` : null,
  }));
}

export async function bannerImage(id: number): Promise<{ bytes: Buffer; mime: string } | null> {
  const rows = await query<{ image: Buffer; image_mime: string }>(`select image, image_mime from shop_banner where id = $1 and image is not null`, [id]);
  return rows[0] ? { bytes: rows[0].image, mime: rows[0].image_mime } : null;
}
