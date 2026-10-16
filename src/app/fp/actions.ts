"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { deleteFpRow, getFpRow, saveFpRow } from "@/lib/fp/crud";
import { screenFor } from "@/lib/fp/screens";
import { ROW_ACTIONS } from "@/lib/fp/rowActions";
import { createBookingOrder, createCounterSale, createReturn, createStockTransfer, type OrderLineInput } from "@/lib/fp/dms";

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

async function needEdit(routeKey: string) {
  const user = await userFromToken((await cookies()).get("session")?.value);
  if (!user || !atLeast(levelFor(user, `fp.${routeKey}`), "edit")) throw new Error("You do not have permission to change this.");
  return user;
}

/** A button on a grid row (accept, reject, cancel, payment...). */
export async function fpRowAction(routeKey: string, actionId: string, rowId: string, input: { reason?: string; quantities?: Record<string, number>; amount?: number; modeUid?: string | null }) {
  return run(async () => {
    await needEdit(routeKey);
    const action = ROW_ACTIONS[routeKey]?.find((a) => a.id === actionId);
    if (!action) throw new Error("Unknown action");
    await action.run(rowId, input);
    revalidatePath("/fp", "layout");
  });
}

export type DocKind = "order-primary" | "order-secondary" | "counter-sale" | "sales-return" | "purchase-return" | "stock-transfer";
export interface DocInput { kind: DocKind; from: string; to: string; staff: string | null; reason?: string; lines: OrderLineInput[] }

/** Create an order / counter sale / return / stock transfer from the document editor. */
export async function fpCreateDoc(routeKey: string, i: DocInput) {
  return run(async () => {
    const user = await needEdit(routeKey);
    const staff = i.staff || null;
    void user;
    let id: string;
    switch (i.kind) {
      case "order-primary": id = await createBookingOrder({ kind: "primary", buyer: i.from, seller: i.to, staff, lines: i.lines }); break;
      case "order-secondary": id = await createBookingOrder({ kind: "secondary", buyer: i.from, seller: i.to, staff, lines: i.lines }); break;
      case "counter-sale": id = await createCounterSale({ seller: i.from, staff, lines: i.lines }); break;
      case "sales-return": id = await createReturn({ kind: "sales", from: i.from, to: i.to, staff, reason: i.reason ?? "", lines: i.lines }); break;
      case "purchase-return": id = await createReturn({ kind: "purchase", from: i.from, to: i.to, staff, reason: i.reason ?? "", lines: i.lines }); break;
      case "stock-transfer": id = await createStockTransfer({ fromFirm: i.from, toStaff: i.to, userUid: staff, lines: i.lines }); break;
      default: throw new Error("Unknown document");
    }
    revalidatePath("/fp", "layout");
    return id;
  });
}
