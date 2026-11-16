import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { one, query } from "@/lib/db";
import { loadAccessUser, userFromToken, type AccessUser } from "@/lib/access-server";
import { atLeast, levelFor, type Level } from "@/lib/access";

/**
 * Who is calling the Dashboard API (db/101_api_keys.sql):
 *  - a signed-in Dashboard user (the `session` cookie), or
 *  - another system with an API key: `Authorization: Bearer gk_...`. The key acts as the Dashboard user it was made
 *    for, with exactly their access, so it never reaches more than that user could on screen.
 * `who` is what the change log records.
 */
export interface ApiCaller {
  user: AccessUser;
  who: string;
  /** the API key's id, when called with one */
  keyId: number | null;
}

const KEY_RE = /^Bearer (gk_[A-Za-z0-9]{40})$/;
const hash = (key: string) => createHash("sha256").update(key).digest("hex");

/** A new key: shown once to whoever made it; only its hash is stored. */
export function newApiKey(): { key: string; prefix: string; hash: string } {
  const key = `gk_${randomBytes(20).toString("hex")}`; // 160 random bits
  return { key, prefix: key.slice(0, 11), hash: hash(key) };
}

export async function apiCaller(req: NextRequest): Promise<ApiCaller | null> {
  const bearer = KEY_RE.exec(req.headers.get("authorization") ?? "")?.[1];
  if (bearer) {
    const k = await one<{ id: number; name: string; user_id: string; stale: boolean }>(
      `select id, name, user_id, coalesce(last_used_at < now() - interval '5 minutes', true) as stale
         from api_key where key_hash = $1 and revoked_at is null`,
      [hash(bearer)],
    );
    if (!k) return null;
    const user = await loadAccessUser(k.user_id);
    if (!user?.isActive) return null;
    // the list shows when a key was last used; a few minutes' accuracy is enough and saves a write per call
    if (k.stale) await query(`update api_key set last_used_at = now() where id = $1`, [k.id]);
    return { user, who: `${user.name || user.email} (API key "${k.name}")`, keyId: k.id };
  }
  const user = await userFromToken(req.cookies.get("session")?.value);
  return user ? { user, who: user.name || user.email, keyId: null } : null;
}

export const can = (c: ApiCaller, resource: string, need: Level) => atLeast(levelFor(c.user, resource), need);

export const apiError = (status: number, error: string, extra?: Record<string, unknown>) => NextResponse.json({ error, ...extra }, { status });
export const unauthorised = () => apiError(401, "Sign in to the Dashboard or send an API key: Authorization: Bearer gk_...");
export const forbidden = () => apiError(403, "You do not have permission for this.");

/** A JSON body, or null when it is missing, too large or not an object. */
export async function jsonBody(req: NextRequest, max = 200_000): Promise<Record<string, unknown> | null> {
  const text = await req.text();
  if (!text || text.length > max) return null;
  try {
    const v = JSON.parse(text);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
