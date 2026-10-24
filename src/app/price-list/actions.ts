"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import * as pl from "@/lib/price-list";

/** Price list changes - edit access to the Price list page is needed for each one. */

async function editor() {
  const me = await userFromToken((await cookies()).get("session")?.value);
  return me && atLeast(levelFor(me, "pricelist"), "edit") ? me.name || me.email : null;
}
const NO = { ok: false as const, error: "You do not have permission to change prices." };
const done = <T,>(r: T) => {
  revalidatePath("/price-list", "layout");
  return r;
};

export async function savePriceAction(target: pl.Target, productUid: string, value: number | null) {
  const who = await editor();
  return who ? done(await pl.setPrice(target, productUid, value, who)) : NO;
}

export async function createListAction(name: string, grp: string) {
  const who = await editor();
  return who ? done(await pl.createList(name, grp, who)) : NO;
}

export async function updateListAction(uid: string, patch: { name?: string; grp?: string; active?: boolean }) {
  const who = await editor();
  return who ? done(await pl.updateList(uid, patch, who)) : NO;
}

export async function findCustomersAction(q: string) {
  if (!(await editor()) || q.trim().length < 2) return [];
  return pl.findCustomers(q);
}

export async function addCustomerAction(listUid: string, firmUid: string) {
  const who = await editor();
  return who ? done(await pl.addCustomer(listUid, firmUid, who)) : NO;
}

export async function removeCustomerAction(listUid: string, firmUid: string) {
  const who = await editor();
  return who ? done(await pl.removeCustomer(listUid, firmUid, who)) : NO;
}
