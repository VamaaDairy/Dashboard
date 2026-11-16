import "server-only";
import { one, query } from "@/lib/db";
import { newApiKey } from "./access";

export interface ApiKeyRow {
  id: number;
  name: string;
  userId: string;
  user: string;
  prefix: string;
  createdBy: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export async function listApiKeys(): Promise<ApiKeyRow[]> {
  return query<ApiKeyRow>(
    `select k.id, k.name, k.user_id as "userId", coalesce(nullif(u.name, ''), u.email) as user, k.prefix, k.created_by as "createdBy",
            k.created_at as "createdAt", k.last_used_at as "lastUsedAt", k.revoked_at as "revokedAt"
       from api_key k join app_user u on u.id = k.user_id
      order by k.revoked_at is not null, k.created_at desc`,
  );
}

/** Makes a key for [userId]; the key is returned once and never stored. */
export async function createApiKey(userId: string, name: string, by: string): Promise<{ ok: true; key: string } | { ok: false; error: string }> {
  const label = name.trim().replace(/\s+/g, " ");
  if (!label || label.length > 80) return { ok: false, error: "Give the key a name (what will use it), up to 80 characters." };
  const user = await one<{ is_active: boolean }>(`select is_active from app_user where id = $1`, [userId]);
  if (!user) return { ok: false, error: "Choose the user this key acts as." };
  if (!user.is_active) return { ok: false, error: "That user is switched off." };
  const k = newApiKey();
  await query(`insert into api_key (name, user_id, prefix, key_hash, created_by) values ($1, $2, $3, $4, $5)`, [label, userId, k.prefix, k.hash, by]);
  await query(`insert into master_audit (actor, slug, record_id, action, summary) values ($1, 'apikeys', $2, 'create', $3)`, [by, k.prefix, `API key "${label}" made`]);
  return { ok: true, key: k.key };
}

export async function revokeApiKey(id: number, by: string): Promise<boolean> {
  const r = await one<{ name: string; prefix: string }>(
    `update api_key set revoked_at = now(), revoked_by = $2 where id = $1 and revoked_at is null returning name, prefix`,
    [id, by],
  );
  if (r) await query(`insert into master_audit (actor, slug, record_id, action, summary) values ($1, 'apikeys', $2, 'update', $3)`, [by, r.prefix, `API key "${r.name}" revoked`]);
  return !!r;
}
