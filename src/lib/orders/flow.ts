/** Status flows for orders and purchase orders. Pure, shared by the server (to enforce) and the UI (to offer buttons). */
export const ORDER_FLOW: Record<string, string[]> = {
  created: ["approved", "cancelled"],
  approved: ["invoiced", "cancelled"],
  invoiced: ["delivered", "cancelled"],
  delivered: [],
  cancelled: ["created"],
};

export const PO_FLOW: Record<string, string[]> = {
  draft: ["ordered", "cancelled"],
  ordered: ["received", "cancelled"],
  received: [],
  cancelled: ["draft"],
};
