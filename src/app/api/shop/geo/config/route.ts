import { NextResponse } from "next/server";
import { mapStyleUrl, olaEnabled } from "@/lib/shop/ola";

export const dynamic = "force-dynamic";

/**
 * Whether maps are switched on, and the style to draw them with. `stylePath` (on this server)
 * is the one to use: Ola's own `styleUrl` leaves the key off tile requests and draws blank.
 */
export function GET() {
  return NextResponse.json({ enabled: olaEnabled(), styleUrl: mapStyleUrl(), stylePath: olaEnabled() ? "/api/shop/geo/style" : null });
}
