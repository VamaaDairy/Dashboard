/** Order and payment states - shared by the server and the dashboard. */
export const ORDER_STATUSES = ["placed", "confirmed", "packed", "shipped", "delivered", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const PAYMENT_STATUSES = ["unpaid", "verifying", "paid", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
