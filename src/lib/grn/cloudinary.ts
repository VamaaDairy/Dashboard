import "server-only";
import { createHash } from "node:crypto";

const FOLDER = "grn";

function creds() {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME, key = process.env.CLOUDINARY_API_KEY, secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud || !key || !secret) throw new Error("Cloudinary is not set up (CLOUDINARY_* in .env).");
  return { cloud, key, secret };
}

/** Cloudinary wants the signed params sorted, joined as k=v&k=v, with the secret appended, SHA-1 hashed. */
function sign(params: Record<string, string>, secret: string) {
  const body = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("&");
  return createHash("sha1").update(body + secret).digest("hex");
}

async function call(cloud: string, action: "upload" | "destroy", form: FormData): Promise<{ secure_url?: string; public_id?: string; result?: string; error?: { message: string } }> {
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/${action}`, { method: "POST", body: form });
  return res.json();
}

export async function uploadGrnImage(file: File): Promise<{ url: string; publicId: string }> {
  const { cloud, key, secret } = creds();
  const signed = { folder: FOLDER, timestamp: String(Math.floor(Date.now() / 1000)) };
  const form = new FormData();
  form.set("file", file);
  form.set("api_key", key);
  form.set("signature", sign(signed, secret));
  for (const [k, v] of Object.entries(signed)) form.set(k, v);
  const out = await call(cloud, "upload", form);
  if (!out.secure_url || !out.public_id) throw new Error(out.error?.message ?? "Cloudinary did not accept the image.");
  return { url: out.secure_url, publicId: out.public_id };
}

export async function deleteGrnImage(publicId: string): Promise<void> {
  const { cloud, key, secret } = creds();
  const signed = { public_id: publicId, timestamp: String(Math.floor(Date.now() / 1000)) };
  const form = new FormData();
  form.set("api_key", key);
  form.set("signature", sign(signed, secret));
  for (const [k, v] of Object.entries(signed)) form.set(k, v);
  await call(cloud, "destroy", form);
}

/** A square thumbnail of an uploaded image, compressed and in the best format for the browser. */
export const thumb = (url: string) => url.replace("/upload/", "/upload/c_fill,w_400,h_400,q_auto,f_auto/");
