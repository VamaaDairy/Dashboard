/**
 * Self-test of the D2C delivery area (db/124, src/lib/shop/area.ts): Raipur and up to D2C_AREA_KM (5) km around it.
 * Ola is replaced by a pretend city - a disc of 8 km around a spot far from India - so nothing real is asked or cached.
 * Local database only; the cache rows it makes are removed again.
 *
 *   DATABASE_URL=postgres://localhost:5432/costing_erp npx tsx db/area-selftest.ts
 */
if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "")) throw new Error("Local database only.");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const m = require("node:module"); const p = require.resolve("server-only");
require.cache[p] = new m.Module(p); require.cache[p].loaded = true; require.cache[p].exports = {};
let failures = 0;
const check = (ok: boolean, what: string) => { console.log(`${ok ? "PASS" : "FAIL"}  ${what}`); if (!ok) failures++; };

(async () => {
  const { query, pool } = await import("@/lib/db");
  const { deliveryArea, setLocalityLookup, AREA_KM } = await import("@/lib/shop/area");
  const C = { lat: -40, lng: -120 }; // middle of the pretend city, in the Pacific
  const R = 8; // its radius, km
  const km = (lat: number, lng: number) => {
    const dLat = ((lat - C.lat) * Math.PI) / 180, dLng = ((lng - C.lng) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((C.lat * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(a));
  };
  const east = (d: number) => ({ lat: C.lat, lng: C.lng + d / (111.32 * Math.cos((C.lat * Math.PI) / 180)) });
  let asked = 0, down = false;
  setLocalityLookup(async (lat, lng) => { asked++; return down ? null : km(lat, lng) <= R ? "Raipur" : km(lat, lng) <= R + 20 ? "Atal Nagar" : ""; });
  const clean = () => query(`delete from geo_locality where cell like '-3_.%' or cell like '-4_.%'`);
  await clean();

  try {
    check(AREA_KM === 5, `the area reaches ${AREA_KM} km outside the city`);
    let r = await deliveryArea(C);
    check(r.ok && r.how === "city", "a pin in the city can order");
    r = await deliveryArea(east(R - 0.5));
    check(r.ok && r.how === "city", "a pin just inside the edge can order");
    r = await deliveryArea(east(R + 2));
    check(r.ok && r.how === "near", "2 km outside the city can order");
    r = await deliveryArea(east(R + 4.5));
    check(r.ok && r.how === "near", "4.5 km outside the city can order");
    r = await deliveryArea(east(R + 7));
    check(!r.ok && /only in Raipur/.test(r.message) && /browse/.test(r.message), "7 km outside is refused, saying they can still browse");
    r = await deliveryArea({ ...east(R + 30), pincode: "492001" });
    check(!r.ok, "a far pin is refused even with a Raipur pincode typed in");

    asked = 0;
    await deliveryArea(east(R + 7));
    check(asked === 0, "Ola's answers are kept, so the same spot is not asked again");

    // no pin (older app versions): the pincode decides
    check((await deliveryArea({ pincode: "492001" })).ok, "no pin, Raipur pincode 492001: can order");
    check((await deliveryArea({ pincode: "492 015" })).ok, "no pin, 492 015 with a space: can order");
    check(!(await deliveryArea({ pincode: "493111" })).ok, "no pin, pincode 493111: refused");
    const none = await deliveryArea({});
    check(!none.ok && /map/.test(none.message), "no pin and no pincode: refused, asking for the map pin");
    check((await deliveryArea({ lat: "-40", lng: "-120" })).ok, "coordinates read back from the database as text still work");

    // Ola cannot be asked: the pincode decides
    down = true;
    const far = east(R + 60);
    check((await deliveryArea({ ...far, pincode: "492004" })).ok, "Ola down, Raipur pincode: can order");
    check(!(await deliveryArea({ ...far, pincode: "411001" })).ok, "Ola down, other pincode: refused");
  } finally {
    await clean();
    await pool.end();
  }
  console.log(failures ? `\n${failures} FAILED` : "\nall passed");
  process.exit(failures ? 1 : 0);
})();
