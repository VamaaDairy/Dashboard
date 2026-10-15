// No "server-only" here: the proxy imports this too, and it doesn't run with the react-server condition.
import { one } from "./db";
import { verifySession } from "./auth";
import { cleanAccess, type AccessMap } from "./access";

export interface AccessUser {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  access: AccessMap;
}

/** Temporary: skips sign-in everywhere and treats every visitor as an owner. Set to false to restore login. */
export const AUTH_DISABLED = false;

const GUEST_OWNER: AccessUser = {
  id: "guest", email: "owner@local", name: "Owner", role: "owner", isActive: true, access: {},
};

export async function loadAccessUser(id: string): Promise<AccessUser | null> {
  const row = await one<{ id: string; email: string; name: string; role: string; is_active: boolean; access: unknown }>(
    `select id, email, name, role, is_active, access from app_user where id = $1`, [id],
  );
  if (!row) return null;
  return { id: row.id, email: row.email, name: row.name, role: row.role, isActive: row.is_active, access: cleanAccess(row.access) };
}

/** The signed-in, still-active user behind a session cookie, read fresh from the database. */
export async function userFromToken(token: string | undefined): Promise<AccessUser | null> {
  if (AUTH_DISABLED) return GUEST_OWNER;
  if (!token) return null;
  const session = await verifySession(token);
  if (!session) return null;
  const user = await loadAccessUser(session.userId);
  return user && user.isActive ? user : null;
}
