import { cookies } from "next/headers";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { boardFilter, exportOrders, type BoardParams } from "@/lib/shop/order-board";

const cell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  // a leading = + - @ would run as a formula in a spreadsheet
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** The D2C orders the page's filters match, as a CSV file. */
export async function GET(req: Request) {
  const me = await userFromToken((await cookies()).get("session")?.value);
  if (!me || !atLeast(levelFor(me, "shop"), "view")) return new Response("Not allowed", { status: 403 });
  const sp = Object.fromEntries(new URL(req.url).searchParams) as BoardParams;
  const rows = await exportOrders({ ...boardFilter(sp), page: 1 });
  const head = ["Order", "Placed", "Day", "Type", "Customer", "Phone", "Address", "Pincode", "Note", "Items", "Qty", "Subtotal", "Delivery fee", "Total", "Payment", "Payment status", "Status", "Rider", "Assigned", "Picked up", "Delivered", "Rating"];
  const body = rows.map((r) => [r.order_no, r.placed, r.day, r.type, r.name, r.phone, r.address, r.pincode, r.notes, r.items, r.qty, r.subtotal, r.delivery_fee, r.total, r.payment_method, r.payment_status, r.status, r.rider, r.assigned, r.picked_up, r.delivered, r.rating].map(cell).join(","));
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  return new Response("﻿" + [head.join(","), ...body].join("\r\n"), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="d2c-orders-${day}.csv"` },
  });
}
