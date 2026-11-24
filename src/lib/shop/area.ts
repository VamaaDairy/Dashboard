import "server-only";
import { one, query } from "@/lib/db";
import { localityAt } from "./ola";

/**
 * Where the D2C app takes orders: Raipur, and up to [AREA_KM] km outside it. Anyone can still browse the products.
 *
 * "In Raipur" is what Ola Maps says - the delivery pin's locality is Raipur. Just outside, a pin is in the area when
 * some spot within AREA_KM of it is in Raipur: spots on rings around the pin (half the distance, then the full
 * distance) are asked, stopping at the first that is. Ola's answers are kept per ~100 m square (geo_locality), so a
 * neighbourhood is asked once.
 * Without a pin (older apps), or when Ola cannot be asked, a Raipur pincode (4920xx) is the test.
 */

export const AREA_CITY = "Raipur";
export const AREA_KM = Number(process.env.D2C_AREA_KM ?? 5) || 5;
export const OUTSIDE = `Sorry, we deliver only in ${AREA_CITY} and up to ${AREA_KM} km around it for now. You can still browse all our products.`;

/** For tests: replaces Ola. */
let lookup: (lat: number, lng: number) => Promise<string | null> = localityAt;
export const setLocalityLookup = (f: typeof lookup) => {
  lookup = f;
};

const cellOf = (lat: number, lng: number) => `${lat.toFixed(3)},${lng.toFixed(3)}`;

/** Is this spot in Raipur? null when Ola could not say. */
async function inCity(lat: number, lng: number): Promise<boolean | null> {
  const cell = cellOf(lat, lng);
  const kept = await one<{ locality: string }>(`select locality from geo_locality where cell = $1`, [cell]);
  let locality = kept?.locality ?? null;
  if (locality === null) {
    locality = await lookup(lat, lng);
    if (locality === null) return null;
    await query(`insert into geo_locality (cell, locality) values ($1, $2) on conflict (cell) do update set locality = excluded.locality, checked_at = now()`, [cell, locality]);
  }
  return locality.toLowerCase() === AREA_CITY.toLowerCase();
}

/** A spot [km] away from (lat, lng) towards [bearing] degrees. */
function step(lat: number, lng: number, km: number, bearing: number): [number, number] {
  const R = 6371, d = km / R, b = (bearing * Math.PI) / 180, p1 = (lat * Math.PI) / 180, l1 = (lng * Math.PI) / 180;
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
  const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return [(p2 * 180) / Math.PI, (l2 * 180) / Math.PI];
}

export const raipurPincode = (pincode: string | null | undefined) => /^4920\d{2}$/.test((pincode ?? "").replace(/\D/g, ""));

export type AreaCheck = { ok: true; how: "city" | "near" | "pincode" } | { ok: false; message: string };

/** Can the D2C app deliver to this pin (or, without one, this pincode)? */
export async function deliveryArea(at: { lat?: number | string | null; lng?: number | string | null; pincode?: string | null }): Promise<AreaCheck> {
  const lat = at.lat == null ? NaN : Number(at.lat), lng = at.lng == null ? NaN : Number(at.lng);
  const byPincode = (): AreaCheck =>
    raipurPincode(at.pincode) ? { ok: true, how: "pincode" }
      : { ok: false, message: at.pincode ? OUTSIDE : `${OUTSIDE} Mark your delivery address on the map so we can check it.` };
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return byPincode();

  const here = await inCity(lat, lng);
  if (here === null) return byPincode(); // Ola could not be asked
  if (here) return { ok: true, how: "city" };
  // just outside: some spot within AREA_KM of the pin is in Raipur
  for (const [km, n] of [[AREA_KM / 2, 8], [AREA_KM, 16]] as const) {
    for (let i = 0; i < n; i++) {
      const [a, b] = step(lat, lng, km, (360 / n) * i);
      if (await inCity(a, b)) return { ok: true, how: "near" };
    }
  }
  return { ok: false, message: OUTSIDE };
}
