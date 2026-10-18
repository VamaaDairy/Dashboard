import "server-only";
import { query } from "@/lib/db";

/** A banner as the app sees it. `image` is a path on this server, versioned so a new upload is not served from cache. */
export interface ShopBanner {
  id: number;
  title: string;
  subtitle: string | null;
  cta: string | null;
  sku: string | null;
  bgColor: string;
  image: string | null;
}

/** What the carousel shows right now: active, inside its dates (India time), highest priority first. */
export async function liveBanners(): Promise<ShopBanner[]> {
  const rows = await query<{ id: number; title: string; subtitle: string | null; cta: string | null; sku: string | null; bg_color: string; has_image: boolean; v: string }>(
    `select id, title, subtitle, cta, sku_code as sku, bg_color, image is not null as has_image,
            extract(epoch from updated_at)::bigint::text as v
       from shop_banner
      where active
        and (starts_at is null or starts_at <= (now() at time zone 'Asia/Kolkata')::date)
        and (ends_at is null or ends_at >= (now() at time zone 'Asia/Kolkata')::date)
      order by priority desc, id`,
  );
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    subtitle: r.subtitle,
    cta: r.cta,
    sku: r.sku,
    bgColor: r.bg_color,
    image: r.has_image ? `/api/shop/banners/${r.id}/image?v=${r.v}` : null,
  }));
}

export async function bannerImage(id: number): Promise<{ bytes: Buffer; mime: string } | null> {
  const rows = await query<{ image: Buffer; image_mime: string }>(`select image, image_mime from shop_banner where id = $1 and image is not null`, [id]);
  return rows[0] ? { bytes: rows[0].image, mime: rows[0].image_mime } : null;
}
