"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { deleteRow, saveRow } from "@/lib/orders/crud";
import { saveSettings } from "@/lib/orders/settings";
import { importCsv } from "@/lib/orders/upload";
import {
  adjustStock, deleteOrder, deletePurchase, saveOrder, savePurchase, setOrderStatus, setPurchaseStatus,
  type OrderInput, type PurchaseInput,
} from "@/lib/orders/trade";

export type Result<T = undefined> = ({ ok: true } & (T extends undefined ? object : { data: T })) | { ok: false; error: string };

/** The access key a user needs "edit" on to change each entity - an action can be called with any entity name, so check here too. */
const ENTITY_ACCESS: Record<string, string> = {
  product: "orders.products", scheme: "orders.products", category: "orders.config", brand: "orders.config",
  channel: "orders.config", designation: "orders.config", expense_type: "orders.config",
  customer: "orders.customers",
  staff: "orders.fieldforce", beat: "orders.fieldforce", visit: "orders.fieldforce", attendance: "orders.fieldforce",
  expense: "orders.fieldforce", task: "orders.fieldforce",
  payment: "orders.collections", credit_note: "orders.collections",
  delivery: "orders.logistics", return: "orders.logistics", van_transfer: "orders.logistics",
  channel_rate: "orders.products", slab: "orders.products", planogram: "orders.products", green_target: "orders.products",
  unmap_request: "orders.customers", customer_target: "orders.customers",
  leave: "orders.fieldforce", holiday: "orders.fieldforce", hiring: "orders.fieldforce", promoter: "orders.fieldforce",
  display_audit: "orders.fieldforce", location_log: "orders.fieldforce",
  broadcast: "orders.engage", catalogue: "orders.engage", quiz: "orders.engage", quiz_question: "orders.engage", quiz_result: "orders.engage",
  sync_log: "orders.admin",
  kpi_target: "orders.kpi", ticket: "orders.support",
};

async function need(key: string) {
  const user = await userFromToken((await cookies()).get("session")?.value);
  if (!user || !atLeast(levelFor(user, key), "edit")) throw new Error("You do not have permission to change this.");
}

async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() } as Result<T>;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong" };
  }
}

const touch = () => revalidatePath("/orders", "layout");

export async function saveEntity(entity: string, id: string | null, values: Record<string, unknown>) {
  return run(async () => {
    const key = ENTITY_ACCESS[entity];
    if (!key) throw new Error("Unknown record type");
    await need(key);
    await saveRow(entity, id, values);
    touch();
  });
}

export async function deleteEntity(entity: string, id: string) {
  return run(async () => {
    const key = ENTITY_ACCESS[entity];
    if (!key) throw new Error("Unknown record type");
    await need(key);
    await deleteRow(entity, id);
    touch();
  });
}

const ORDER_ACCESS = { primary: "orders.primary", secondary: "orders.secondary", counter: "orders.counter" } as const;

export async function saveOrderAction(input: OrderInput) {
  return run(async () => {
    await need(ORDER_ACCESS[input.kind] ?? "orders.primary");
    const id = await saveOrder(input);
    touch();
    return id;
  });
}

export async function orderStatusAction(kind: keyof typeof ORDER_ACCESS, id: string, status: string) {
  return run(async () => {
    await need(ORDER_ACCESS[kind] ?? "orders.primary");
    await setOrderStatus(id, status);
    touch();
  });
}

export async function deleteOrderAction(kind: keyof typeof ORDER_ACCESS, id: string) {
  return run(async () => {
    await need(ORDER_ACCESS[kind] ?? "orders.primary");
    await deleteOrder(id);
    touch();
  });
}

export async function savePurchaseAction(input: PurchaseInput) {
  return run(async () => {
    await need("orders.purchase");
    const id = await savePurchase(input);
    touch();
    return id;
  });
}

export async function purchaseStatusAction(id: string, status: string) {
  return run(async () => {
    await need("orders.purchase");
    await setPurchaseStatus(id, status);
    touch();
  });
}

export async function deletePurchaseAction(id: string) {
  return run(async () => {
    await need("orders.purchase");
    await deletePurchase(id);
    touch();
  });
}

export async function adjustStockAction(productId: string, qty: number, reason: "opening" | "adjust" | "return", note: string) {
  return run(async () => {
    await need("orders.inventory");
    await adjustStock(productId, qty, reason, note);
    touch();
  });
}

const UPLOAD_ACCESS = "orders.admin";

export async function uploadCsvAction(entity: string, text: string) {
  return run(async () => {
    await need(UPLOAD_ACCESS);
    // each entity needs edit on its own section too, so an upload can't reach further than the screens do
    const own = entity === "opening_stock" ? "orders.inventory" : ENTITY_ACCESS[entity];
    if (!own) throw new Error("That cannot be uploaded");
    await need(own);
    const res = await importCsv(entity, text);
    touch();
    return res;
  });
}

export async function saveSettingsAction(values: Record<string, string>) {
  return run(async () => {
    await need(UPLOAD_ACCESS);
    await saveSettings(values);
    touch();
  });
}
