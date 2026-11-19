/**
 * An order's road, one step after another: placed -> confirmed (by the office) -> dispatched (its trip left the plant)
 * -> out for delivery (the truck's next stop is this order) -> delivered | not delivered; or cancelled. Kept apart from
 * ./index (server-only) so pages and components can use the labels too.
 */
export type OrderStep = "placed" | "confirmed" | "dispatched" | "out_for_delivery" | "delivered" | "not_delivered" | "cancelled";

export const STEP_LABEL: Record<OrderStep, string> = {
  placed: "Pending", confirmed: "Confirmed", dispatched: "Dispatched", out_for_delivery: "Out for delivery",
  delivered: "Delivered", not_delivered: "Not delivered", cancelled: "Cancelled",
};

/** The steps in order, for a road drawn step by step. */
export const ROAD: OrderStep[] = ["placed", "confirmed", "dispatched", "out_for_delivery", "delivered"];
