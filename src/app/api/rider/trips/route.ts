import { NextResponse, type NextRequest } from "next/server";
import { fail } from "@/lib/shop/api";
import { riderFromRequest } from "@/lib/shop/rider";
import { transporterTrips } from "@/lib/dispatch";
import { loadsOf } from "@/lib/dispatch/load";

export const dynamic = "force-dynamic";

/**
 * A transporter's trips (Dashboard: App orders > Dispatch): the one on the road first, then the planned ones, then
 * the last week's finished ones. Each trip has its stops in delivery order with the buyer's address, phone, map pin,
 * what is on the order, and the stop's outcome; and load: what goes on the vehicle, product by product
 * ({ name, qty, unit, packs, loose, base }) for the stops still to deliver.
 */
export async function GET(req: NextRequest) {
  const rider = await riderFromRequest(req);
  if (!rider) return fail(401, "Please sign in again.");
  if (rider.kind !== "transporter") return NextResponse.json({ trips: [] });
  const trips = await transporterTrips(rider.id);
  const loads = await loadsOf(trips.filter((t) => t.status !== "completed").map((t) => t.id));
  return NextResponse.json({
    trips: trips.map((t) => ({
      ...t,
      load: (loads.get(t.id) ?? []).map((l) => ({ name: l.name, qty: l.qty, unit: l.pack?.unit ?? null, packs: l.packs, loose: l.loose, base: l.pack?.base ?? "PCS" })),
    })),
  });
}
