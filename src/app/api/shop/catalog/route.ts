import type { NextRequest } from "next/server";
import { jsonWithEtag } from "@/lib/shop/api";
import { listProducts, listProductsForDisplay } from "@/lib/shop/catalog";
import { categoryIcons } from "@/lib/products/app-products";
import { deliveryRule } from "@/lib/shop/orders";
import { shop } from "@/lib/whatsapp/config";
import { easebuzzReady } from "@/lib/payments/easebuzz";
import { menuCache } from "@/lib/api/hot-cache";

export const dynamic = "force-dynamic";

/** Everything the app needs to draw the menu: shop details, delivery rule, categories and products. */
export async function GET(req: NextRequest) {
  // ?all=1 (app 1.3.5+): also the hidden / switched-off products, marked unavailable, to show as out of stock.
  // Older apps don't ask, so they never see them as buyable. Orders only ever accept what is on sale.
  const all = req.nextUrl.searchParams.get("all") === "1";
  // every app open asks for this: built once and shared for 30 s per server process (src/lib/api/hot-cache.ts)
  const body = await menuCache.get(`d2c:${all ? "all" : "sale"}`, () => buildMenu(all));
  // ETag: an app that already has this exact menu gets a 304 and downloads nothing
  return jsonWithEtag(req, body);
}

async function buildMenu(all: boolean) {
  const [products, icons] = await Promise.all([all ? listProductsForDisplay() : listProducts(), categoryIcons("d2c")]);

  // a category's icon from Product Master, else its first product's photo
  const cats = new Map<string, { name: string; image: string | null; count: number }>();
  for (const p of products) {
    const c = cats.get(p.category) ?? { name: p.category, image: icons.get(p.category) ?? null, count: 0 };
    c.count++;
    c.image ??= p.image;
    cats.set(p.category, c);
  }

  return {
    shop: { name: shop.name || "Gaia", deliveryFee: deliveryRule.fee, freeDeliveryAbove: deliveryRule.freeAbove, currency: "INR", paymentMethods: easebuzzReady() ? ["cod", "online"] : ["cod"] },
    categories: [...cats.values()],
    products,
  };
}
