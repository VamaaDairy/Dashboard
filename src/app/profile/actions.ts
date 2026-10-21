"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { query } from "@/lib/db";
import { userFromToken } from "@/lib/access-server";

export type ProfileResult = { ok: true } | { ok: false; error: string };

/** Saves the signed-in user's recovery email (where a forgot-password code is sent). Empty removes it. */
export async function saveRecoveryEmail(email: string): Promise<ProfileResult> {
  const me = await userFromToken((await cookies()).get("session")?.value);
  if (!me) return { ok: false, error: "Please sign in again." };
  const e = email.trim().toLowerCase();
  if (e && (e.length > 254 || !/^\S+@\S+\.\S+$/.test(e))) return { ok: false, error: "Enter a valid email address." };
  try {
    await query(`update app_user set recovery_email = $2 where id = $1`, [me.id, e || null]);
  } catch (err) {
    if (err instanceof Error && /app_user_recovery_email_uq|duplicate key/.test(err.message)) {
      return { ok: false, error: "Another account already uses that email." };
    }
    console.error("saveRecoveryEmail failed", err);
    return { ok: false, error: "Could not save the email." };
  }
  revalidatePath("/profile");
  return { ok: true };
}
