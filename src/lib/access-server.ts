// No "server-only" here: the proxy imports this too, and it doesn't run with the react-server condition.
import { one } from "./db";
import { verifySession } from "./auth";
import { cleanAccess, mergeAccess, type AccessMap } from "./access";

export interface AccessUser {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  /** What they may open: their department's access plus their own (the higher level wins). */
  access: AccessMap;
  /** Given to them personally, on top of the department's. */
  personal: AccessMap;
  department: { id: number; name: string; access: AccessMap } | null;
}

/** Temporary: skips sign-in everywhere and treats every visitor as an owner. Set to false to restore login. */
export const AUTH_DISABLED = false;

const GUEST_OWNER: AccessUser = {
  id: "guest", email: "owner@local", name: "Owner", role: "owner", isActive: true, access: {}, personal: {}, department: null,
};

export async function loadAccessUser(id: string): Promise<AccessUser | null> {
  // the department: the one set on the login, else that of the employee the login is (Employee Master)
  const row = await one<{
    id: string; email: string; name: string; role: string; is_active: boolean; access: unknown;
    dept_id: number | null; dept_name: string | null; dept_access: unknown;
  }>(
    `select u.id, u.email, u.name, u.role, u.is_active, u.access, d.id as dept_id, d.name as dept_name, d.access as dept_access
       from app_user u
       left join emp_master em on em.app_user_id = u.id
       left join department d on d.id = coalesce(u.department_id, em.department_id)
      where u.id = $1`,
    [id],
  );
  if (!row) return null;
  const personal = cleanAccess(row.access);
  const department = row.dept_id === null ? null : { id: row.dept_id, name: row.dept_name ?? "", access: cleanAccess(row.dept_access) };
  return {
    id: row.id, email: row.email, name: row.name, role: row.role, isActive: row.is_active,
    access: department ? mergeAccess(department.access, personal) : personal, personal, department,
  };
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
