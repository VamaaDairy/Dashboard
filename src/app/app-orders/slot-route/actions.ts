"use server";

import { slotRoutePaths, slotRoutePlan, type SlotRoutePlan } from "@/lib/dispatch/slot-route";
import type { LngLat } from "@/lib/shop/track";

/** A route's options by road (Ola) - the first time can take a minute, Ola's answers are then kept for six hours. */
export async function slotRouteAction(id: string): Promise<SlotRoutePlan | { error: string }> {
  try {
    return (await slotRoutePlan(id)) ?? { error: "No such route." };
  } catch (e) {
    console.error("slot route", e);
    return { error: "Could not work out the roads right now. Please try again in a minute." };
  }
}

/** The roads to draw for one option of a route: one path per drive, the last one back to the depot. */
export async function slotRoutePathsAction(id: string, order: number[]): Promise<LngLat[][] | null> {
  try {
    return await slotRoutePaths(id, order);
  } catch (e) {
    console.error("slot route paths", e);
    return null;
  }
}
