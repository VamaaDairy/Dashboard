import { createHash } from "node:crypto";

const NAMESPACE = Buffer.from("7f0c1b6e5a2d4e0a9c3b8d41e6f25a10", "hex");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Name-based (v5) uuid, so the same key always yields the same uid. */
export function uid(name: string): string {
  const h = createHash("sha1").update(NAMESPACE).update(name).digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString("hex");
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

/** The uid Footprints gave a row, or - for the few that aren't proper uuids - one derived from its code. */
export function given(v: unknown, fallbackKey: string): string {
  const s = typeof v === "string" ? v.trim() : "";
  return UUID.test(s) ? s.toLowerCase() : uid(fallbackKey);
}
