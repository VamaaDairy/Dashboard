import "server-only";
import { wa } from "./config";

/** The WhatsApp Cloud API and catalog calls, over Meta's Graph API. Nothing here touches the database. */

const base = () => `https://graph.facebook.com/${wa.graphVersion}`;

export class GraphError extends Error {
  constructor(message: string, public code?: number) {
    super(message);
  }
}

async function graph<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!wa.token) throw new GraphError("WA_ACCESS_TOKEN is not set");
  const res = await fetch(path.startsWith("http") ? path : `${base()}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${wa.token}`, ...(init.headers ?? {}) },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (data as { error?: { message?: string; code?: number; error_data?: { details?: string } } }).error;
    const detail = err?.error_data?.details ? ` (${err.error_data.details})` : "";
    throw new GraphError(`${err?.message ?? `Graph API ${res.status}`}${detail}`, err?.code);
  }
  return data as T;
}

// ---------------------------------------------------------------- messages

/** Any Cloud API message body, without messaging_product / to. */
export type OutPayload =
  | { type: "text"; text: { body: string; preview_url?: boolean } }
  | { type: "image"; image: { link?: string; id?: string; caption?: string } }
  | { type: "document"; document: { link?: string; id?: string; caption?: string; filename?: string } }
  | { type: "interactive"; interactive: Record<string, unknown> };

export async function sendMessage(to: string, payload: OutPayload): Promise<string> {
  if (!wa.phoneNumberId) throw new GraphError("WA_PHONE_NUMBER_ID is not set");
  const data = await graph<{ messages?: { id: string }[] }>(`/${wa.phoneNumberId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, ...payload }),
  });
  const id = data.messages?.[0]?.id;
  if (!id) throw new GraphError("WhatsApp accepted the message but returned no id");
  return id;
}

/** Blue ticks on their message, plus "typing…" while the assistant thinks. Best effort. */
export async function markReadAndTyping(messageId: string) {
  try {
    await graph(`/${wa.phoneNumberId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
        typing_indicator: { type: "text" },
      }),
    });
  } catch {
    /* cosmetic only */
  }
}

// ---------------------------------------------------------------- media

export async function downloadMedia(mediaId: string): Promise<{ bytes: Buffer; mime: string }> {
  const info = await graph<{ url: string; mime_type: string }>(`/${mediaId}`);
  const res = await fetch(info.url, { headers: { Authorization: `Bearer ${wa.token}` }, cache: "no-store" });
  if (!res.ok) throw new GraphError(`Media download failed (${res.status})`);
  return { bytes: Buffer.from(await res.arrayBuffer()), mime: info.mime_type };
}

export async function uploadMedia(bytes: Buffer, mime: string, filename: string): Promise<string> {
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", mime);
  form.append("file", new Blob([new Uint8Array(bytes)], { type: mime }), filename);
  const data = await graph<{ id: string }>(`/${wa.phoneNumberId}/media`, { method: "POST", body: form });
  return data.id;
}

// ---------------------------------------------------------------- catalog

export interface CatalogProduct {
  id: string;
  retailer_id?: string;
  name?: string;
  description?: string;
  price?: string;
  sale_price?: string;
  currency?: string;
  image_url?: string;
  url?: string;
  availability?: string;
  visibility?: string;
}

/** The catalog linked to the WhatsApp Business Account, unless WA_CATALOG_ID names one. */
export async function resolveCatalogId(): Promise<string> {
  if (wa.catalogId) return wa.catalogId;
  if (!wa.wabaId) throw new GraphError("Set WA_CATALOG_ID, or WA_BUSINESS_ACCOUNT_ID so the linked catalog can be found");
  const data = await graph<{ data: { id: string; name?: string }[] }>(`/${wa.wabaId}/product_catalogs`);
  const id = data.data?.[0]?.id;
  if (!id) throw new GraphError("No catalog is connected to this WhatsApp Business Account (Commerce Manager > Catalog > connect to WhatsApp)");
  return id;
}

export interface CatalogItemInput {
  id: string; // retailer id / SKU
  title: string;
  description: string;
  availability: string;
  price: string; // "60.00 INR"
  image_link: string;
  link: string;
  brand: string;
  condition: "new";
}

/** Creates or updates catalog items in one batch. Meta processes it asynchronously and returns handles. */
export async function upsertCatalogItems(catalogId: string, items: CatalogItemInput[]): Promise<string[]> {
  const form = new URLSearchParams({
    item_type: "PRODUCT_ITEM",
    allow_upsert: "true",
    requests: JSON.stringify(items.map((data) => ({ method: "UPDATE", data }))),
  });
  const res = await graph<{ handles?: string[] }>(`/${catalogId}/items_batch`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  return res.handles ?? [];
}

export async function batchStatus(catalogId: string, handle: string) {
  const res = await graph<{ data?: { status: string; errors?: { id?: string; message: string }[]; warnings?: { id?: string; message: string }[] }[] }>(
    `/${catalogId}/check_batch_request_status?handle=${encodeURIComponent(handle)}`,
  );
  return res.data?.[0] ?? { status: "unknown" };
}

export async function fetchCatalogProducts(catalogId: string): Promise<CatalogProduct[]> {
  const fields = "id,retailer_id,name,description,price,sale_price,currency,image_url,url,availability,visibility";
  const out: CatalogProduct[] = [];
  let next: string | undefined = `/${catalogId}/products?fields=${fields}&limit=100`;
  for (let page = 0; next && page < 50; page++) {
    const data: { data: CatalogProduct[]; paging?: { next?: string } } = await graph(next);
    out.push(...(data.data ?? []));
    next = data.paging?.next;
  }
  return out;
}
