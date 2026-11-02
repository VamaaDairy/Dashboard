import { cookies } from "next/headers";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";

/** Whether the signed-in user may change Store data (pages show forms only to them). */
export async function canEditStore() {
  const me = await userFromToken((await cookies()).get("session")?.value);
  return !!me && atLeast(levelFor(me, "store"), "edit");
}

export const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
export const num = (v: string | string[] | undefined) => { const n = Number(str(v)); return Number.isInteger(n) && n > 0 ? n : undefined; };
export const dateOnly = (v: string | string[] | undefined) => (/^\d{4}-\d{2}-\d{2}$/.test(str(v)) ? str(v) : undefined);
