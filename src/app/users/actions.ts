"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { query } from "@/lib/db";
import { userFromToken } from "@/lib/access-server";
import { cleanAccess, type AccessMap } from "@/lib/access";
import { hashPassword } from "@/lib/users";

export type UserResult = { ok: true } | { ok: false; error: string };
const fail = (error: string): UserResult => ({ ok: false, error });

const ROLES = ["owner", "editor", "viewer"] as const;
type Role = (typeof ROLES)[number];

export interface UserInput {
  id?: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  access: AccessMap;
  /** Required for a new user; on an existing one, only set when changing it. */
  password?: string;
}

/** Only an owner may manage users - checked here as well as in the proxy, since actions are plain POSTs. */
async function requireOwner() {
  const me = await userFromToken((await cookies()).get("session")?.value);
  return me && me.role === "owner" ? me : null;
}

export async function saveUser(input: UserInput): Promise<UserResult> {
  const me = await requireOwner();
  if (!me) return fail("Only an owner can manage users.");

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const role = input.role as Role;
  const password = input.password?.trim() ?? "";
  if (!name) return fail("Name is required.");
  if (!/^\S+@\S+\.\S+$/.test(email)) return fail("Enter a valid email - it is the user name they sign in with.");
  if (!ROLES.includes(role)) return fail("Unknown role.");
  if (password && password.length < 8) return fail("Password must be at least 8 characters.");
  const access = JSON.stringify(cleanAccess(input.access));

  try {
    if (!input.id) {
      if (!password) return fail("Set a password for the new user.");
      await query(
        `insert into app_user (email, name, role, password_hash, is_active, access)
         values ($1, $2, $3, $4, $5, $6::jsonb)`,
        [email, name, role, await hashPassword(password), input.isActive, access],
      );
    } else {
      // an owner can't lock themselves out by accident
      if (input.id === me.id && (role !== "owner" || !input.isActive)) {
        return fail("You can't remove your own owner access or deactivate yourself.");
      }
      await query(
        `update app_user set email = $2, name = $3, role = $4, is_active = $5, access = $6::jsonb
          where id = $1`,
        [input.id, email, name, role, input.isActive, access],
      );
      if (password) {
        await query(`update app_user set password_hash = $2 where id = $1`, [input.id, await hashPassword(password)]);
      }
    }
  } catch (e) {
    if (e instanceof Error && /app_user_email_key|duplicate key/.test(e.message)) {
      return fail("Someone already uses that email.");
    }
    console.error("saveUser failed", e);
    return fail("Could not save the user.");
  }
  revalidatePath("/users");
  return { ok: true };
}
