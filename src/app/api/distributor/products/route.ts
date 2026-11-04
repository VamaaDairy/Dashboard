import type { NextRequest } from "next/server";
import { fail, jsonWithEtag } from "@/lib/shop/api";
import { appChannelOf, catalogFor, distFromRequest } from "@/lib/distributor";
import { categoryIcons } from "@/lib/products/app-products";

export const dynamic = "force-dynamic";

/** The shop catalogue at this distributor's dealer price. ?firm=<uid> (optional for a distributor). */
export async function GET(req: NextRequest) {
  const login = await distFromRequest(req);
  if (!login) return fail(401, "Please sign in again.");
  const products = await catalogFor(login, req.nextUrl.searchParams.get("firm") ?? undefined);
  if (!products) return fail(400, "Choose the distributor first.");
  // the list's categories in order, each with its icon from Product Master (null = the app uses a product photo)
  const icons = await categoryIcons(appChannelOf(login));
  const categories = [...new Set(products.map((p) => p.category))].map((name) => ({ name, image: icons.get(name) ?? null }));
  // dealer prices are per login: private, and an app that already has this exact list gets a 304
  return jsonWithEtag(req, { products, categories }, 0, "private");
}
