import type { NextRequest } from "next/server";
import { jsonWithEtag } from "@/lib/shop/api";
import { listProducts } from "@/lib/shop/catalog";
import { categoryIcons } from "@/lib/products/app-products";
import { deliveryRule } from "@/lib/shop/orders";
import { shop } from "@/lib/whatsapp/config";
import { easebuzzReady } from "@/lib/payments/easebuzz";

export const dynamic = "force-dynamic";

/** Everything the app needs to draw the menu: shop details, delivery rule, categories and products. */
export async function GET(req: NextRequest) {
  const [products, icons] = await Promise.all([listProducts(), categoryIcons("d2c")]);

  // a category's icon from Product Master, else its first product's photo
  const cats = new Map<string, { name: string; image: string | null; count: number }>();
  for (const p of products) {
    const c = cats.get(p.category) ?? { name: p.category, image: icons.get(p.category) ?? null, count: 0 };
    c.count++;
    c.image ??= p.image;
    cats.set(p.category, c);
  }

  // ETag: an app that already has this exact menu gets a 304 and downloads nothing
  return jsonWithEtag(
    req,
    {
      shop: { name: shop.name || "Gaia", deliveryFee: deliveryRule.fee, freeDeliveryAbove: deliveryRule.freeAbove, currency: "INR", paymentMethods: easebuzzReady() ? ["cod", "online"] : ["cod"] },
      categories: [...cats.values()],
      products,
    },
  );
}
