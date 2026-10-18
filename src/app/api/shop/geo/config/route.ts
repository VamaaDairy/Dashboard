import { NextResponse } from "next/server";
import { mapStyleUrl } from "@/lib/shop/ola";

export const dynamic = "force-dynamic";

/** Whether maps are switched on, and the style the app and dashboard draw them with. */
export function GET() {
  const styleUrl = mapStyleUrl();
  return NextResponse.json({ enabled: styleUrl !== null, styleUrl });
}
