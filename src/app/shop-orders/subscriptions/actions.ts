"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { officeSetDay, officeSetStatus, officeUpdatePlan, officeVacation } from "@/lib/shop/subscription-office";

type Result = { ok: true; message?: string } | { ok: false; error: string };

/** Who may change subscriptions: edit rights on Online shop orders. */
async function editor(): Promise<string | null> {
  const me = await userFromToken((await cookies()).get("session")?.value);
  return me && atLeast(levelFor(me, "shop"), "edit") ? me.name || me.email : null;
}

const denied: Result = { ok: false, error: "You do not have permission to change subscriptions." };
const ids = (...n: unknown[]) => n.every((x) => Number.isInteger(x) && (x as number) > 0);
const done = (r: Result) => {
  if (r.ok) revalidatePath("/shop-orders/subscriptions");
  return r;
};

export async function updatePlanAction(customerId: number, id: number, body: Record<string, unknown>): Promise<Result> {
  const who = await editor();
  if (!who) return denied;
  if (!ids(customerId, id) || typeof body !== "object" || !body) return { ok: false, error: "Invalid request." };
  return done(await officeUpdatePlan(who, customerId, id, body));
}

export async function setStatusAction(customerId: number, id: number, status: "active" | "paused" | "cancelled"): Promise<Result> {
  const who = await editor();
  if (!who) return denied;
  if (!ids(customerId, id) || !["active", "paused", "cancelled"].includes(status)) return { ok: false, error: "Invalid request." };
  return done(await officeSetStatus(who, customerId, id, status));
}

export async function vacationAction(customerId: number, from: string, to: string, skip: boolean): Promise<Result> {
  const who = await editor();
  if (!who) return denied;
  if (!ids(customerId)) return { ok: false, error: "Invalid request." };
  return done(await officeVacation(who, customerId, String(from), String(to), skip === true));
}

export async function setDayAction(customerId: number, id: number, day: string, qty: number | null): Promise<Result> {
  const who = await editor();
  if (!who) return denied;
  if (!ids(customerId, id)) return { ok: false, error: "Invalid request." };
  return done(await officeSetDay(who, customerId, id, String(day), qty === null ? null : Number(qty)));
}
