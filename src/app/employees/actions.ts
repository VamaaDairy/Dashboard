"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { isWing, linkDashboardUser, placeEmployees, saveDepartment, type Result, type Wing } from "@/lib/employees";

async function editor() {
  const me = await userFromToken((await cookies()).get("session")?.value);
  return me && atLeast(levelFor(me, "employees"), "edit") ? me : null;
}
const denied: Result = { ok: false, error: "You do not have permission to do this." };

/** Moves employees to a group and/or department ("" leaves that part as it is, "none" clears it). */
export async function placeAction(uids: string[], wing: string, department: string): Promise<Result> {
  const me = await editor();
  if (!me) return denied;
  const change: { wing?: Wing | null; departmentId?: number | null } = {};
  if (wing === "none") change.wing = null;
  else if (wing) { if (!isWing(wing)) return { ok: false, error: "Unknown group." }; change.wing = wing; }
  if (department === "none") change.departmentId = null;
  else if (department) change.departmentId = Number(department);
  if (change.wing === undefined && change.departmentId === undefined) return { ok: false, error: "Choose a group or a department." };
  const r = await placeEmployees(uids, change, me.email);
  revalidatePath("/employees", "layout");
  return r;
}

export async function linkUserAction(staffUid: string, userId: string): Promise<Result> {
  const me = await editor();
  if (!me) return denied;
  const r = await linkDashboardUser(staffUid, userId || null, me.email);
  revalidatePath(`/employees/staff/${staffUid}`);
  return r;
}

export async function saveDepartmentAction(input: { id?: number; name: string; wing: string; active?: boolean }): Promise<Result> {
  const me = await editor();
  if (!me) return denied;
  const r = await saveDepartment({ id: input.id, name: input.name, wing: isWing(input.wing) ? input.wing : null, active: input.active }, me.email);
  revalidatePath("/employees", "layout");
  return r;
}
