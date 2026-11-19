import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { customerFromRequest } from "@/lib/shop/customer";
import { decodeImage, folderFor, photosOf, savePhoto } from "@/lib/photos";

export const dynamic = "force-dynamic";

/** The signed-in customer's photos of the delivery spot (gate, door, building), newest first. Optional. */
export async function GET(req: NextRequest) {
  const c = await customerFromRequest(req);
  if (!c) return fail(401, "Please sign in again.");
  const photos = await photosOf("customer_location", String(c.id));
  return NextResponse.json({ photos: photos.map((p) => ({ ...p, url: `/api/shop/customer/photo/${p.id}` })) });
}

/** Adds a photo of the delivery spot. Body: { image: base64 JPEG / PNG }. Saved in customers/<id>_<name>/ on the server. */
export async function POST(req: NextRequest) {
  const c = await customerFromRequest(req);
  if (!c) return fail(401, "Please sign in again.");
  if (tooMany(req, "customer-photo", 10)) return fail(429, "Too many photos. Please wait a minute.");
  const b = (await readJson(req, 6_000_000)) as { image?: unknown } | null;
  const img = decodeImage(b?.image);
  if ("error" in img) return fail(400, img.error);
  const p = await savePhoto("customer_location", String(c.id), folderFor("customer_location", { id: c.id, name: c.name }), img, `${c.name} (customer, app)`);
  return NextResponse.json({ photo: { ...p, url: `/api/shop/customer/photo/${p.id}` } }, { status: 201 });
}
