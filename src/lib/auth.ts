import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";

export type Role = "owner" | "editor" | "viewer";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret-change-me");

export async function createSession(userId: string, email: string, role: Role) {
  return await new SignJWT({ userId, email, role })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifySession(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as { userId: string; email: string; role: Role };
  } catch {
    return null;
  }
}
