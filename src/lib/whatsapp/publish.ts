import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { batchStatus, resolveCatalogId, upsertCatalogItems } from "./graph";

/**
 * Products we publish *to* the Meta catalog, from data/wa-catalog.json with
 * images in public/products. Meta fetches each image from PUBLIC_BASE_URL, so
 * the tunnel (or the deployed site) must be up while it processes the batch.
 * The bot never reads this file - it reads the catalog back from Meta.
 */

export interface LocalProduct {
  id: string;
  title: string;
  description: string;
  price: number | null;
  image: string;
  availability: string;
}

export async function localCatalog(): Promise<LocalProduct[]> {
  const raw = await readFile(join(process.cwd(), "data", "wa-catalog.json"), "utf8");
  return (JSON.parse(raw) as { products: LocalProduct[] }).products;
}

export const publicBaseUrl = () => (process.env.PUBLIC_BASE_URL ?? "").replace(/\/+$/, "");

export async function publishLocalCatalog(): Promise<{ published: string[]; skipped: string[]; status: string; errors: string[] }> {
  const base = publicBaseUrl();
  if (!/^https:\/\//.test(base)) throw new Error("Set PUBLIC_BASE_URL to your public https URL (the tunnel) so Meta can download the images");

  const all = await localCatalog();
  const ready = all.filter((p) => typeof p.price === "number" && p.price > 0);
  const skipped = all.filter((p) => !ready.includes(p)).map((p) => `${p.title} (no price)`);
  if (!ready.length) throw new Error("No product has a price yet - fill them in data/wa-catalog.json");

  const catalogId = await resolveCatalogId();
  const handles = await upsertCatalogItems(
    catalogId,
    ready.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      availability: p.availability || "in stock",
      price: `${p.price!.toFixed(2)} INR`,
      image_link: `${base}/products/${p.image}`,
      link: process.env.SHOP_WEBSITE || `${base}/products/${p.image}`,
      brand: "Gaia",
      condition: "new",
    })),
  );

  // Meta usually finishes a small batch within seconds; report what it says.
  let status = "submitted";
  const errors: string[] = [];
  for (let i = 0; i < 5 && handles.length; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const s = await batchStatus(catalogId, handles[0]);
    status = s.status;
    if (s.status === "finished") {
      for (const e of [...("errors" in s ? (s.errors ?? []) : []), ...("warnings" in s ? (s.warnings ?? []) : [])]) {
        errors.push(`${e.id ?? ""} ${e.message}`.trim());
      }
      break;
    }
  }
  return { published: ready.map((p) => p.title), skipped, status, errors };
}
