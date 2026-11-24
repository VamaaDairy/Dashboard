import "server-only";
import { cookies } from "next/headers";
import { userFromToken, type AccessUser } from "@/lib/access-server";

/**
 * Who may record batches on Stellar from the Production page: the logins listed in TRACE_USERS
 * (comma-separated emails) on the server. Unset or empty = nobody - the button, its dialog and the
 * extra queries stay out of everyone's Production page. The public /trace page is not affected.
 */
export function canRecordTrace(user: Pick<AccessUser, "email" | "isActive"> | null): boolean {
  if (!user?.isActive) return false;
  const allowed = (process.env.TRACE_USERS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(user.email.trim().toLowerCase());
}

/** The signed-in user, if they may record batches on Stellar. */
export async function traceUser(): Promise<AccessUser | null> {
  const me = await userFromToken((await cookies()).get("session")?.value);
  return me && canRecordTrace(me) ? me : null;
}
