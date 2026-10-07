import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";

export type Role = "owner" | "editor" | "viewer";

// The repo is public, so a built-in fallback secret would let anyone forge a
// session. Locally a dev secret is fine; in production JWT_SECRET must be set,
// and without it no session is issued or accepted.
const isProd = process.env.NODE_ENV === "production";
const raw = process.env.JWT_SECRET || (isProd ? "" : "dev-secret-change-me");
const secret = raw ? new TextEncoder().encode(raw) : null;

export const AUTH_NOT_CONFIGURED = "JWT_SECRET is not set for this deployment - add it in the hosting settings and redeploy.";

export async function createSession(userId: string, email: string, role: Role) {
  if (!secret) throw new Error(AUTH_NOT_CONFIGURED);
  return await new SignJWT({ userId, email, role })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifySession(token: string) {
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as { userId: string; email: string; role: Role };
  } catch {
    return null;
  }
}
