"use server";

import { slotRoutePlan, type SlotRoutePlan } from "@/lib/dispatch/slot-route";

/** The round by road (Ola) - the first time can take a minute, Ola's answers are then kept for six hours. */
export async function slotRouteAction(): Promise<SlotRoutePlan | { error: string }> {
  try {
    return await slotRoutePlan();
  } catch (e) {
    console.error("slot route", e);
    return { error: "Could not work out the roads right now. Please try again in a minute." };
  }
}
