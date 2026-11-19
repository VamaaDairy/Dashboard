import { NextResponse, type NextRequest } from "next/server";
import { fail, readJson, tooMany } from "@/lib/shop/api";
import { one } from "@/lib/db";
import { distFromRequest } from "@/lib/distributor";
import { decodeImage, folderFor, photosOf, savePhoto } from "@/lib/photos";

export const dynamic = "force-dynamic";

/** The signed-in distributor's / retailer's photos of its outlet, newest first (Gaia Distributors app, Account). Optional. */
export async function GET(req: NextRequest) {
  const login = await distFromRequest(req);
  if (!login?.firmUid) return fail(401, "Please sign in again.");
  const photos = await photosOf("outlet", login.firmUid);
  return NextResponse.json({ photos: photos.map((p) => ({ ...p, url: `/api/distributor/photo/${p.id}` })) });
}

/** Adds a photo of the outlet. Body: { image: base64 JPEG / PNG }. Saved in outlets/<code>_<name>/ on the server. */
export async function POST(req: NextRequest) {
  const login = await distFromRequest(req);
  if (!login?.firmUid) return fail(401, "Please sign in again.");
  if (tooMany(req, "outlet-photo", 10)) return fail(429, "Too many photos. Please wait a minute.");
  const b = (await readJson(req, 6_000_000)) as { image?: unknown } | null;
  const img = decodeImage(b?.image);
  if ("error" in img) return fail(400, img.error);
  const f = await one<{ code: string | null; name: string }>(`select firm_code as code, name from fp_firm where uid = $1`, [login.firmUid]);
  const p = await savePhoto("outlet", login.firmUid, folderFor("outlet", { code: f?.code, name: f?.name }), img, `${login.name} (${login.kind}, app)`);
  return NextResponse.json({ photo: { ...p, url: `/api/distributor/photo/${p.id}` } }, { status: 201 });
}
