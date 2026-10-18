import { NextResponse } from "next/server";
import { listProducts } from "@/lib/shop/catalog";
import { deliveryRule } from "@/lib/shop/orders";
import { shop } from "@/lib/whatsapp/config";

export const dynamic = "force-dynamic";

/** Everything the app needs to draw the menu: shop details, delivery rule, categories and products. */
export async function GET() {
  const products = await listProducts();

  const cats = new Map<string, { name: string; image: string | null; count: number }>();
  for (const p of products) {
    const c = cats.get(p.category) ?? { name: p.category, image: null, count: 0 };
    c.count++;
    c.image ??= p.image;
    cats.set(p.category, c);
  }

  return NextResponse.json(
    {
      shop: { name: shop.name || "Gaia", deliveryFee: deliveryRule.fee, freeDeliveryAbove: deliveryRule.freeAbove, currency: "INR", paymentMethods: ["cod"] },
      categories: [...cats.values()],
      products,
    },
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}
