"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { deleteFpRow, getFpRow, saveFpRow } from "@/lib/fp/crud";
import { screenFor } from "@/lib/fp/screens";

export type FpResult<T = undefined> = ({ ok: true } & (T extends undefined ? object : { data: T })) | { ok: false; error: string };

async function guard(routeKey: string) {
  const screen = screenFor(routeKey);
  if (!screen?.table || !screen.editable) throw new Error("This screen cannot change records.");
  const user = await userFromToken((await cookies()).get("session")?.value);
  if (!user || !atLeast(levelFor(user, `fp.${routeKey}`), "edit")) throw new Error("You do not have permission to change this.");
  return screen.table.entity;
}

async function run<T>(fn: () => Promise<T>): Promise<FpResult<T>> {
  try { return { ok: true, data: await fn() } as FpResult<T>; }
  catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Something went wrong" }; }
}

export async function fpSave(routeKey: string, id: string | null, values: Record<string, unknown>) {
  return run(async () => {
    const entity = await guard(routeKey);
    const saved = await saveFpRow(entity, id, values);
    revalidatePath("/fp", "layout");
    return saved;
  });
}

export async function fpDelete(routeKey: string, id: string) {
  return run(async () => {
    const entity = await guard(routeKey);
    await deleteFpRow(entity, id);
    revalidatePath("/fp", "layout");
  });
}

export async function fpLoad(routeKey: string, id: string) {
  return run(async () => getFpRow(await guard(routeKey), id));
}
