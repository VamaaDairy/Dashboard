import { cookies } from "next/headers";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";

/** Whether the signed-in user may change things under an access key. Reading is already gated by the proxy. */
export async function canEdit(key: string): Promise<boolean> {
  const user = await userFromToken((await cookies()).get("session")?.value);
  return !!user && atLeast(levelFor(user, key), "edit");
}

export type SP = Promise<Record<string, string | string[] | undefined>>;

export async function params(sp: SP): Promise<Record<string, string>> {
  const raw = await sp;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) out[k] = Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
  return out;
}
