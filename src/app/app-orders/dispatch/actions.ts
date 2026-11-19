"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { cancelTrip, createTrip, routeRoadPlan, updateTrip, type TripInput } from "@/lib/dispatch";
import { approveFirmRequest, rejectFirmRequest } from "@/lib/distributor/requests";

type R = { ok: true; id?: number } | { ok: false; error: string };
const NO = { ok: false as const, error: "You do not have permission to change this." };

async function editor() {
  const me = await userFromToken((await cookies()).get("session")?.value);
  return me && atLeast(levelFor(me, "apporders"), "edit") ? me.name || me.email : null;
}

export async function createTripAction(input: TripInput): Promise<R> {
  const who = await editor();
  if (!who) return NO;
  const r = await createTrip(input, who);
  revalidatePath("/app-orders/dispatch", "layout");
  return r;
}

export async function updateTripAction(id: number, input: Omit<TripInput, "date" | "routeId" | "routeName"> & { routeName?: string }): Promise<R> {
  const who = await editor();
  if (!who) return NO;
  const r = await updateTrip(id, input, who);
  revalidatePath("/app-orders/dispatch", "layout");
  return r;
}

export async function cancelTripAction(id: number): Promise<R> {
  const who = await editor();
  if (!who) return NO;
  const r = await cancelTrip(id, who);
  revalidatePath("/app-orders/dispatch", "layout");
  return r;
}

export async function approveRequestAction(id: number, input: { code: string; channelUid: string; parentUid?: string | null; beatUid?: string | null }): Promise<R> {
  const who = await editor();
  if (!who) return NO;
  const r = await approveFirmRequest(id, input, who);
  revalidatePath("/app-orders/new-customers");
  return r.ok ? { ok: true } : r;
}

export async function rejectRequestAction(id: number, reason: string): Promise<R> {
  const who = await editor();
  if (!who) return NO;
  const r = await rejectFirmRequest(id, reason, who);
  revalidatePath("/app-orders/new-customers");
  return r;
}

/** One route's outlets in their road order from the plant, with the road path (Routes map). Anyone who can see Dispatch. */
export async function roadPlanAction(routeId: number) {
  const me = await userFromToken((await cookies()).get("session")?.value);
  if (!me || !atLeast(levelFor(me, "apporders"), "view")) return null;
  if (!Number.isInteger(routeId) || routeId < 1) return null;
  return routeRoadPlan(routeId);
}
