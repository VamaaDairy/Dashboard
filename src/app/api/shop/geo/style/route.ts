import { NextResponse } from "next/server";
import { fail } from "@/lib/shop/api";
import { mapStyle } from "@/lib/shop/ola";

export const dynamic = "force-dynamic";

/** The Ola map style with the key on every tile, font and icon URL - what the app and dashboard maps load. */
export async function GET() {
  const style = await mapStyle();
  if (!style) return fail(503, "Maps are not available right now.");
  return NextResponse.json(style, { headers: { "Cache-Control": "public, max-age=3600" } });
}
