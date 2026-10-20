"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { query } from "@/lib/db";
import { userFromToken } from "@/lib/access-server";
import { levelFor, atLeast } from "@/lib/access";
import { deleteGrnImage, uploadGrnImage } from "@/lib/grn/cloudinary";

export type GrnResult = { ok: true } | { ok: false; error: string };

const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 3 * 1024 * 1024;

async function actor() {
  const me = await userFromToken((await cookies()).get("session")?.value);
  return me && atLeast(levelFor(me, "grn"), "edit") ? me : null;
}

/** Saves the image against the invoice number. */
export async function addGrn(form: FormData): Promise<GrnResult> {
  const me = await actor();
  if (!me) return { ok: false, error: "You do not have permission to do this." };

  const invoice = String(form.get("invoice_no") ?? "").trim();
  if (!invoice) return { ok: false, error: "Invoice number is required." };
  if (invoice.length > 60) return { ok: false, error: "Invoice number is too long." };

  const file = form.get("image");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose the GRN image." };
  if (!TYPES.has(file.type)) return { ok: false, error: "The image must be a JPG, PNG or WebP." };
  if (file.size > MAX_BYTES) return { ok: false, error: "The image is over 3 MB - pick a smaller one." };

  let up: { url: string; publicId: string };
  try { up = await uploadGrnImage(file); } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Could not upload the image." }; }
  await query(
    `insert into grn (invoice_no, image_url, public_id, created_by) values ($1, $2, $3, $4)`,
    [invoice, up.url, up.publicId, me.name ?? me.email],
  );
  revalidatePath("/grn");
  return { ok: true };
}

export async function deleteGrn(id: number): Promise<GrnResult> {
  const me = await actor();
  if (!me) return { ok: false, error: "You do not have permission to do this." };
  const [row] = await query<{ public_id: string | null }>(`delete from grn where id = $1 returning public_id`, [id]);
  if (row?.public_id) await deleteGrnImage(row.public_id).catch(() => {});
  revalidatePath("/grn");
  return { ok: true };
}
