import "server-only";

/**
 * Ola Maps (api.olamaps.io). The key stays on the server for places / geocoding / routing;
 * only the map-tile style URL (which needs a key in the browser or phone) is handed out,
 * and OLA_MAPS_TILE_KEY lets that be a separate, restricted key.
 */
const BASE = "https://api.olamaps.io";
const key = () => process.env.OLA_MAPS_API_KEY ?? "";
const tileKey = () => process.env.OLA_MAPS_TILE_KEY || key();

export const olaEnabled = () => key().length > 0;
export const mapStyleUrl = () =>
  olaEnabled() ? `${BASE}/tiles/vector/v1/styles/default-light-standard/style.json?api_key=${encodeURIComponent(tileKey())}` : null;

type Json = Record<string, unknown>;
let styleCache: { at: number; json: Json } | null = null;

/**
 * Ola's map style, ready to draw. Ola wants the key on every tile, font and icon request, but its
 * style.json and tile manifests leave it off - MapLibre (the app and the dashboard) then gets 401s
 * and draws an empty map. Here each vector source's manifest is read on the server and inlined as
 * tile URLs that carry the key, and the sprite and font URLs get it too. Cached for 6 hours.
 */
export async function mapStyle(): Promise<Json | null> {
  if (!olaEnabled()) return null;
  if (styleCache && Date.now() - styleCache.at < 6 * 3600_000) return styleCache.json;
  const k = encodeURIComponent(tileKey());
  const withKey = (u: string) => `${u}${u.includes("?") ? "&" : "?"}api_key=${k}`;
  const get = async (u: string): Promise<Json | null> => {
    try {
      const r = await fetch(withKey(u), { signal: AbortSignal.timeout(8000), cache: "no-store" });
      return r.ok ? ((await r.json()) as Json) : (console.error("ola style", u, r.status), null);
    } catch (e) {
      console.error("ola style", u, e);
      return null;
    }
  };
  const style = await get(`${BASE}/tiles/vector/v1/styles/default-light-standard/style.json`);
  if (!style) return null;
  const sources = (style.sources ?? {}) as Record<string, Json>;
  await Promise.all(
    Object.entries(sources).map(async ([name, src]) => {
      if (typeof src.url !== "string") return;
      const tj = await get(src.url);
      const tiles = Array.isArray(tj?.tiles) ? (tj.tiles as string[]) : null;
      if (!tj || !tiles) return;
      const { url: _u, ...rest } = src;
      sources[name] = {
        ...rest,
        tiles: tiles.map(withKey),
        ...(tj.minzoom !== undefined ? { minzoom: tj.minzoom } : {}),
        ...(tj.maxzoom !== undefined ? { maxzoom: tj.maxzoom } : {}),
        ...(tj.attribution ? { attribution: tj.attribution } : {}),
      };
    }),
  );
  if (typeof style.sprite === "string") style.sprite = withKey(style.sprite);
  if (typeof style.glyphs === "string") style.glyphs = withKey(style.glyphs);
  styleCache = { at: Date.now(), json: style };
  return style;
}

async function call<T>(path: string, params: Record<string, string>, method: "GET" | "POST" = "GET"): Promise<T | null> {
  if (!olaEnabled()) return null;
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("api_key", key());
  try {
    const r = await fetch(url, { method, headers: { "X-Request-Id": crypto.randomUUID() }, signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!r.ok) {
      console.error("ola", path, r.status, (await r.text()).slice(0, 200));
      return null;
    }
    return (await r.json()) as T;
  } catch (e) {
    console.error("ola", path, e);
    return null;
  }
}

export interface Suggestion { id: string; title: string; address: string; lat: number | null; lng: number | null }

export async function autocomplete(q: string, near?: { lat: number; lng: number }): Promise<Suggestion[]> {
  const j = await call<{ predictions?: Array<Record<string, any>> }>("/places/v1/autocomplete", {
    input: q,
    ...(near ? { location: `${near.lat},${near.lng}` } : {}),
  });
  return (j?.predictions ?? []).slice(0, 8).map((p) => {
    const loc = p.geometry?.location;
    return {
      id: String(p.place_id ?? p.reference ?? ""),
      title: String(p.structured_formatting?.main_text ?? p.description ?? ""),
      address: String(p.description ?? ""),
      lat: typeof loc?.lat === "number" ? loc.lat : null,
      lng: typeof loc?.lng === "number" ? loc.lng : null,
    };
  });
}

/** Coordinates of a place picked from autocomplete that came back without them. */
export async function placeLatLng(placeId: string): Promise<{ lat: number; lng: number } | null> {
  const j = await call<{ result?: { geometry?: { location?: { lat: number; lng: number } } } }>("/places/v1/details", { place_id: placeId });
  const l = j?.result?.geometry?.location;
  return l ? { lat: l.lat, lng: l.lng } : null;
}

export async function reverse(lat: number, lng: number): Promise<{ address: string; pincode: string | null } | null> {
  const j = await call<{ results?: Array<{ formatted_address?: string; address_components?: Array<{ long_name: string; types: string[] }> }> }>(
    "/places/v1/reverse-geocode",
    { latlng: `${lat},${lng}` },
  );
  const r = j?.results?.[0];
  if (!r?.formatted_address) return null;
  const pin = r.address_components?.find((c) => c.types?.includes("postal_code"))?.long_name ?? r.formatted_address.match(/\b[1-9]\d{5}\b/)?.[0] ?? null;
  return { address: r.formatted_address, pincode: pin };
}

export interface RouteStep { text: string; distanceM: number; maneuver: string }
export interface Route { distanceM: number; durationS: number; points: Array<[number, number]>; steps: RouteStep[] }

/** Google-style encoded polyline (precision 5) -> [lat, lng] pairs. */
export function decodePolyline(s: string): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let i = 0, lat = 0, lng = 0;
  while (i < s.length) {
    for (const axis of [0, 1]) {
      let shift = 0, result = 0, b: number;
      do { b = s.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      const d = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 0) lat += d; else lng += d;
    }
    out.push([lat / 1e5, lng / 1e5]);
  }
  return out;
}

export async function route(from: { lat: number; lng: number }, to: { lat: number; lng: number }): Promise<Route | null> {
  const j = await call<{ routes?: Array<{ overview_polyline?: string; legs?: Array<{ distance?: number; duration?: number; steps?: Array<{ instructions?: string; distance?: number; maneuver?: string }> }> }> }>(
    "/routing/v1/directions",
    { origin: `${from.lat},${from.lng}`, destination: `${to.lat},${to.lng}`, alternatives: "false", steps: "true", overview: "full", mode: "driving" },
    "POST",
  );
  const r = j?.routes?.[0];
  if (!r?.overview_polyline) return null;
  const leg = r.legs?.[0];
  return { distanceM: Number(leg?.distance ?? 0), durationS: Number(leg?.duration ?? 0), points: decodePolyline(r.overview_polyline),
    steps: (leg?.steps ?? []).map((t) => ({ text: String(t.instructions ?? ""), distanceM: Number(t.distance ?? 0), maneuver: String(t.maneuver ?? "") })).filter((t) => t.text),
  };
}
