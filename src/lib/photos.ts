import "server-only";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { one, query } from "@/lib/db";

/**
 * Photos from the apps, saved as files in folders on the server (db/109_app_photos.sql has the layout) and indexed in
 * app_photo. PHOTO_DIR moves the folder; by default it sits next to the Dashboard ("gaia-photos"), outside the code.
 */

export type PhotoKind = "outlet" | "customer_location" | "delivery_home" | "delivery_trade";
export interface Photo { id: number; at: string; bytes: number }

const MAX_BYTES = 4_000_000;

export const photoRoot = () => path.resolve(process.env.PHOTO_DIR || path.join(process.cwd(), "..", "gaia-photos"));

/** A folder name from free text: letters and digits, dashes between, at most 40 characters. */
export const slug = (s: string | null | undefined) =>
  (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "unnamed";

/** The image the app sent (base64, optionally a data: URL), if it really is a JPEG or PNG of a sensible size. */
export function decodeImage(raw: unknown): { buf: Buffer; mime: string; ext: string } | { error: string } {
  if (typeof raw !== "string" || raw.length < 100) return { error: "Send the photo." };
  const b64 = raw.replace(/^data:image\/[a-z]+;base64,/, "");
  if (b64.length > (MAX_BYTES * 4) / 3 + 16) return { error: "That photo is too large (at most 4 MB)." };
  const buf = Buffer.from(b64, "base64");
  if (buf.length < 100) return { error: "That photo could not be read." };
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { buf, mime: "image/jpeg", ext: "jpg" };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { buf, mime: "image/png", ext: "png" };
  return { error: "Send a JPEG or PNG photo." };
}

/** India time as 2026-11-19 and 143005, for folder and file names. */
function stamp() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
      .formatToParts(new Date()).map((x) => [x.type, x.value]),
  );
  return { day: `${p.year}-${p.month}-${p.day}`, month: `${p.year}-${p.month}`, time: `${p.hour}${p.minute}${p.second}` };
}

/** The folder (relative to the photo root) a photo of this kind and owner goes in. */
export function folderFor(kind: PhotoKind, owner: { code?: string | null; name?: string | null; id?: string | number; orderNo?: string | number }): string {
  const t = stamp();
  switch (kind) {
    case "outlet": return path.posix.join("outlets", `${slug(owner.code)}_${slug(owner.name)}`);
    case "customer_location": return path.posix.join("customers", `${owner.id}_${slug(owner.name)}`);
    case "delivery_home": return path.posix.join("deliveries", "home", t.month, t.day, `order-${slug(String(owner.orderNo ?? owner.id))}`);
    case "delivery_trade": return path.posix.join("deliveries", "trade", t.month, t.day, `order-${slug(String(owner.orderNo ?? owner.id))}`);
  }
}

/** Saves the image in its folder and indexes it. */
export async function savePhoto(kind: PhotoKind, ref: string, folder: string, img: { buf: Buffer; mime: string; ext: string }, by: string): Promise<Photo> {
  const t = stamp();
  const dir = path.join(photoRoot(), folder);
  await mkdir(dir, { recursive: true });
  // two photos in the same second get -2, -3 ...
  let name = `${t.day}_${t.time}.${img.ext}`;
  for (let i = 2; await exists(path.join(dir, name)); i++) name = `${t.day}_${t.time}-${i}.${img.ext}`;
  await writeFile(path.join(dir, name), img.buf, { flag: "wx" });
  const rel = path.posix.join(folder, name);
  const r = await one<{ id: number; at: string }>(
    `insert into app_photo (kind, ref, rel_path, bytes, mime, uploaded_by) values ($1, $2, $3, $4, $5, $6) returning id, created_at as at`,
    [kind, ref, rel, img.buf.length, img.mime, by.slice(0, 120)],
  );
  return { id: r!.id, at: new Date(r!.at).toISOString(), bytes: img.buf.length };
}

async function exists(p: string) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/** The photos of one owner, newest first. */
export const photosOf = async (kind: PhotoKind, ref: string): Promise<Photo[]> =>
  (await query<{ id: number; at: string; bytes: number }>(`select id, created_at as at, bytes from app_photo where kind = $1 and ref = $2 order by created_at desc limit 50`, [kind, ref]))
    .map((p) => ({ ...p, at: new Date(p.at).toISOString() }));

/** One photo's bytes, when it is of this kind and owner (or of anyone, for the Dashboard). */
export async function readPhoto(id: number, scope?: { kind: PhotoKind | PhotoKind[]; ref: string }): Promise<{ buf: Buffer; mime: string } | null> {
  if (!Number.isInteger(id) || id < 1) return null;
  const p = await one<{ kind: PhotoKind; ref: string; rel_path: string; mime: string }>(`select kind, ref, rel_path, mime from app_photo where id = $1`, [id]);
  if (!p) return null;
  if (scope && ((Array.isArray(scope.kind) ? !scope.kind.includes(p.kind) : p.kind !== scope.kind) || p.ref !== scope.ref)) return null;
  const file = path.join(photoRoot(), p.rel_path);
  if (!file.startsWith(photoRoot() + path.sep)) return null;
  try {
    return { buf: await readFile(file), mime: p.mime };
  } catch {
    return null;
  }
}

/** The answer for an image request: the bytes, kept privately by the browser / phone for a day. */
export const imageResponse = (p: { buf: Buffer; mime: string }) =>
  new Response(new Uint8Array(p.buf), { headers: { "content-type": p.mime, "cache-control": "private, max-age=86400" } });
