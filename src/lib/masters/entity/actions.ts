"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { MASTERS } from "../schemas";
import { removeRecord, saveRecord, setActive } from "./service";

export type FormState = { ok: false; error: string; fieldErrors?: Record<string, string> } | null;
export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * The signed-in user, if they may edit this screen. Checked here as well as in
 * the proxy: an action id can be posted to any page, so the screen is named in
 * the call and its permission looked up from that.
 */
async function authorise(slug: string) {
  const def = MASTERS[slug];
  if (!def?.entity) return null;
  const me = await userFromToken((await cookies()).get("session")?.value);
  if (!me || !atLeast(levelFor(me, `fp.${slug}`), "edit")) return null;
  return { def, who: me.name || me.email };
}
const denied = { ok: false, error: "You do not have permission to change this." } as const;

/** Add (id null) or update. On success goes back to the list. */
export async function saveEntity(slug: string, id: string | null, _prev: FormState, form: FormData): Promise<FormState> {
  const a = await authorise(slug);
  if (!a) return denied;
  const r = await saveRecord(a.def, id, form, a.who);
  if (!r.ok) return { ok: false, error: r.error, fieldErrors: r.fieldErrors };
  revalidatePath(`/orders/${slug}`);
  redirect(`/orders/${slug}`);
}

export async function toggleEntity(slug: string, id: string, activate: boolean): Promise<ActionResult> {
  const a = await authorise(slug);
  if (!a) return denied;
  const r = await setActive(a.def, id, activate, a.who);
  if (r.ok) revalidatePath(`/orders/${slug}`);
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

export async function deleteEntity(slug: string, id: string): Promise<ActionResult> {
  const a = await authorise(slug);
  if (!a) return denied;
  const r = await removeRecord(a.def, id, a.who);
  if (r.ok) revalidatePath(`/orders/${slug}`);
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}
