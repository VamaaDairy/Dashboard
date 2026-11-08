"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import * as ap from "@/lib/products/app-products";
import type { AppChannel, NewProduct } from "@/lib/products/app-products";

/** Product Master changes - edit access to Product Master is needed for each one. */

/** The editor's name when they may change this list (each list is its own permission), else null. */
async function editor(channel: AppChannel) {
  if (!ap.isAppChannel(channel)) return null;
  const me = await userFromToken((await cookies()).get("session")?.value);
  return me && atLeast(levelFor(me, `productmaster.${channel}`), "edit") ? me.name || me.email : null;
}
const NO = { ok: false as const, error: "You do not have permission to change this product list." };
const BAD = { ok: false as const, error: "Unknown product list." };
const done = <T,>(r: T) => {
  revalidatePath("/product-master", "layout");
  return r;
};

export async function moveProductAction(channel: AppChannel, uid: string, dir: -1 | 1) {
  if (!ap.isAppChannel(channel)) return BAD;
  const who = await editor(channel);
  return who ? done(await ap.moveProduct(channel, uid, dir === -1 ? -1 : 1, who)) : NO;
}

export async function reorderAction(channel: AppChannel, uids: string[]) {
  if (!ap.isAppChannel(channel)) return BAD;
  const who = await editor(channel);
  return who ? done(await ap.reorderProducts(channel, uids, who)) : NO;
}

export async function moveCategoryAction(channel: AppChannel, name: string, dir: -1 | 1) {
  if (!ap.isAppChannel(channel)) return BAD;
  const who = await editor(channel);
  return who ? done(await ap.moveCategory(channel, name, dir === -1 ? -1 : 1, who)) : NO;
}

export async function renameCategoryAction(channel: AppChannel, from: string, to: string) {
  if (!ap.isAppChannel(channel)) return BAD;
  const who = await editor(channel);
  return who ? done(await ap.renameCategory(channel, from, to, who)) : NO;
}

export async function addCategoryAction(channel: AppChannel, name: string) {
  if (!ap.isAppChannel(channel)) return BAD;
  const who = await editor(channel);
  return who ? done(await ap.addCategory(channel, name, who)) : NO;
}

export async function updateProductAction(
  channel: AppChannel,
  uid: string,
  patch: { name?: string | null; size?: string | null; category?: string | null; visible?: boolean },
) {
  if (!ap.isAppChannel(channel)) return BAD;
  const who = await editor(channel);
  return who ? done(await ap.updateProduct(channel, uid, patch, who)) : NO;
}

export async function setPricesAction(channel: AppChannel, uid: string, patch: { mrp: number }) {
  const who = await editor(channel);
  return who ? done(await ap.setPrices(uid, patch, who)) : NO;
}

export async function addToListAction(channel: AppChannel, uids: string[]) {
  if (!ap.isAppChannel(channel)) return BAD;
  const who = await editor(channel);
  return who ? done(await ap.addToList(channel, uids.slice(0, 500), who)) : NO;
}

export async function removeFromListAction(channel: AppChannel, uid: string) {
  if (!ap.isAppChannel(channel)) return BAD;
  const who = await editor(channel);
  return who ? done(await ap.removeFromList(channel, uid, who)) : NO;
}

export async function createProductAction(input: NewProduct, channels: AppChannel[]) {
  const chs = channels.filter(ap.isAppChannel);
  if (!chs.length) return { ok: false as const, error: "Choose at least one app list." };
  // making a product for a list needs edit access to that list
  const whos = await Promise.all(chs.map(editor));
  if (whos.some((w) => !w)) return NO;
  return done(await ap.createProduct(input, chs, whos[0]!));
}

/** The photos of a product, for the edit window - viewing the page is enough. */
export async function photosAction(channel: AppChannel, uid: string) {
  const me = await userFromToken((await cookies()).get("session")?.value);
  if (!me || !ap.isAppChannel(channel) || !atLeast(levelFor(me, `productmaster.${channel}`), "view")) return [];
  return ap.photosOf(uid);
}

export async function archivedPhotosAction(channel: AppChannel, uid: string) {
  const me = await userFromToken((await cookies()).get("session")?.value);
  if (!me || !ap.isAppChannel(channel) || !atLeast(levelFor(me, `productmaster.${channel}`), "view")) return [];
  return ap.archivedPhotosOf(uid);
}

export async function archivePhotoAction(channel: AppChannel, productUid: string, photoUid: string) {
  const who = await editor(channel);
  return who ? done(await ap.archivePhoto(productUid, photoUid, who)) : NO;
}

export async function restorePhotoAction(channel: AppChannel, productUid: string, photoUid: string) {
  const who = await editor(channel);
  return who ? done(await ap.restorePhoto(productUid, photoUid, who)) : NO;
}

/** Form: channel, uid, photo (file), first ("1" = make it the main photo). */
export async function addPhotoAction(form: FormData) {
  const who = await editor(String(form.get("channel") ?? "") as AppChannel);
  if (!who) return NO;
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) return { ok: false as const, error: "Choose a photo." };
  return done(await ap.addPhoto(String(form.get("uid") ?? ""), Buffer.from(await file.arrayBuffer()), file.type, form.get("first") === "1", who));
}

export async function removePhotoAction(channel: AppChannel, productUid: string, photoUid: string) {
  const who = await editor(channel);
  return who ? done(await ap.removePhoto(productUid, photoUid, who)) : NO;
}

export async function makeFirstPhotoAction(channel: AppChannel, productUid: string, photoUid: string) {
  const who = await editor(channel);
  return who ? done(await ap.makeFirstPhoto(productUid, photoUid, who)) : NO;
}

/** Form: channel, name (category), icon (file); no file = remove the icon. */
export async function categoryIconAction(form: FormData) {
  const channel = String(form.get("channel") ?? "") as AppChannel;
  const who = await editor(channel);
  if (!who) return NO;
  const file = form.get("icon");
  const icon = file instanceof File && file.size > 0 ? { bytes: Buffer.from(await file.arrayBuffer()), mime: file.type } : null;
  return done(await ap.setCategoryIcon(channel, String(form.get("name") ?? ""), icon, who));
}

export async function descriptionAction(channel: AppChannel, uid: string, text: string) {
  const who = await editor(channel);
  return who ? done(await ap.setDescription(uid, text, who)) : NO;
}
