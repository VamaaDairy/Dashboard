import "server-only";
import bcrypt from "bcryptjs";
import { one } from "./db";
import type { Role } from "./auth";

export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  password_hash: string | null;
}

export async function getUserByEmail(email: string) {
  return one<UserRow>(
    `select id, email, name, role, password_hash from app_user where lower(email) = lower($1)`,
    [email.trim()],
  );
}

export async function getUserById(id: string) {
  return one<UserRow>(
    `select id, email, name, role, password_hash from app_user where id = $1`, [id],
  );
}

export const verifyPassword = (plain: string, hash: string | null) =>
  hash ? bcrypt.compare(plain, hash) : Promise.resolve(false);

export const hashPassword = (plain: string) => bcrypt.hash(plain, 10);
