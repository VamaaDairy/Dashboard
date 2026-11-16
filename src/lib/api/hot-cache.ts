import "server-only";
import { TtlCache } from "@/lib/cache";

/**
 * The shared caches for what the apps read on every open. Photos and icons are addressed by a versioned URL (a new
 * upload gets a new ?v=), so a cached copy can never be out of date; the menus are kept briefly so a change made in
 * Product Master shows within half a minute.
 */
type Image = { bytes: Buffer; mime: string } | null;

/** Product photos, category icons, banners: up to 64 MB of image bytes per server process, 10 minutes each. */
export const imageCache = new TtlCache<Image>({ ttlMs: 10 * 60_000, maxEntries: 2000, maxBytes: 64 * 1024 * 1024, sizeOf: (v) => v?.bytes.length ?? 0 });

/** Whole menu responses (the D2C catalogue), 30 seconds. */
export const menuCache = new TtlCache<unknown>({ ttlMs: 30_000, maxEntries: 20 });
