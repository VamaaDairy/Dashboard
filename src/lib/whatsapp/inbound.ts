import "server-only";
import { enqueueAgent } from "./agent";
import { handleRatingReply } from "./flow";
import { downloadMedia, markReadAndTyping } from "./graph";
import {
  applyStatus, getProducts, latestOpenOrder, money, recordInbound, saveMedia, updateContact, updateOrder, upsertContact,
} from "./store";

/** Turns one WhatsApp webhook delivery into stored messages, and wakes the assistant. */

interface WaMessage {
  id: string;
  from: string;
  type: string;
  text?: { body: string };
  image?: { id: string; mime_type: string; caption?: string };
  document?: { id: string; mime_type: string; caption?: string; filename?: string };
  video?: { id: string; mime_type: string; caption?: string };
  audio?: { id: string; mime_type: string };
  sticker?: { id: string; mime_type: string };
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  interactive?: {
    type: string;
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string; description?: string };
  };
  button?: { text: string; payload?: string };
  order?: { catalog_id: string; text?: string; product_items: { product_retailer_id: string; quantity: number | string; item_price: number | string; currency: string }[] };
  reaction?: { emoji?: string; message_id: string };
  contacts?: { name?: { formatted_name?: string }; phones?: { phone?: string }[] }[];
}

interface WebhookBody {
  object?: string;
  entry?: {
    changes?: {
      field?: string;
      value?: {
        contacts?: { wa_id: string; profile?: { name?: string } }[];
        messages?: WaMessage[];
        statuses?: { id: string; status: string; recipient_id: string; errors?: { title?: string; message?: string; error_data?: { details?: string } }[] }[];
      };
    }[];
  }[];
}

const MEDIA_TYPES = ["image", "document", "video", "audio", "sticker"] as const;

export async function processWebhook(body: WebhookBody) {
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const v = change.value;
      if (!v) continue;
      console.log(
        `[whatsapp] webhook field=${change.field} messages=${v.messages?.length ?? 0}` +
          ` statuses=${(v.statuses ?? []).map((s) => s.status).join(",") || 0}` +
          ` from=${(v.messages ?? []).map((m) => `${m.from}:${m.type}`).join(",")}`,
      );

      for (const s of v.statuses ?? []) {
        const err = s.errors?.[0];
        await applyStatus(s.id, s.status, err ? `${err.title ?? err.message ?? "failed"}${err.error_data?.details ? ` - ${err.error_data.details}` : ""}` : null);
      }

      const names = new Map((v.contacts ?? []).map((c) => [c.wa_id, c.profile?.name ?? null]));
      for (const m of v.messages ?? []) {
        try {
          await handleMessage(m, names.get(m.from) ?? null);
        } catch (e) {
          console.error("[whatsapp] failed to handle message", m.id, e);
        }
      }
    }
  }
}

async function handleMessage(m: WaMessage, profileName: string | null) {
  const waId = m.from;
  const contact = await upsertContact(waId, profileName);

  // ---- media: fetch it from Meta now, their URLs expire
  let mediaId: number | null = null;
  let mediaNote = "";
  const mediaType = MEDIA_TYPES.find((t) => t === m.type);
  if (mediaType) {
    const media = m[mediaType]!;
    try {
      const { bytes, mime } = await downloadMedia(media.id);
      mediaId = await saveMedia({
        metaMediaId: media.id, mime: mime || media.mime_type, bytes,
        filename: "filename" in media ? (media.filename ?? null) : null,
      });
    } catch (e) {
      mediaNote = ` (couldn't download: ${e instanceof Error ? e.message : e})`;
    }
  }

  // ---- a photo or document while an order is open belongs to that order (payment proof, reference photo...)
  let orderId: number | null = null;
  let paymentProof = false;
  if (m.type === "image" || m.type === "document") {
    const open = await latestOpenOrder(waId);
    if (open && Date.now() - new Date(open.created_at).getTime() < 7 * 86400_000) {
      orderId = open.id;
      if (open.payment_status === "unpaid" && open.payment_method !== "cod") {
        await updateOrder(open.id, { payment_status: "verifying" });
        paymentProof = true;
      }
    }
  }

  // ---- what to show for it in the chat
  let body: string | null = null;
  let cart: { retailer_id: string; qty: number }[] | null = null;
  switch (m.type) {
    case "text": body = m.text?.body ?? ""; break;
    case "image": case "video": case "document":
      body = (m[m.type]?.caption ?? (m.type === "document" ? m.document?.filename : "") ?? "") + mediaNote;
      if (paymentProof) body = `${body ? `${body} ` : ""}[sent as payment proof]`;
      break;
    case "audio": body = `[voice note]${mediaNote}`; break;
    case "sticker": body = "[sticker]"; break;
    case "location": {
      const l = m.location!;
      body = `📍 ${[l.name, l.address].filter(Boolean).join(", ")} (https://maps.google.com/?q=${l.latitude},${l.longitude})`;
      break;
    }
    case "interactive":
      body = m.interactive?.list_reply?.id?.startsWith("add:")
        ? `🛒 Picked "${m.interactive.list_reply.title}" from the Order now list (added 1 to the cart)`
        : m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? "[reply]";
      break;
    case "button": body = m.button?.text ?? ""; break;
    case "reaction": body = m.reaction?.emoji ? `reacted ${m.reaction.emoji}` : "removed a reaction"; break;
    case "contacts": body = `[contact card: ${m.contacts?.map((c) => `${c.name?.formatted_name ?? ""} ${c.phones?.map((p) => p.phone).join("/") ?? ""}`).join("; ")}]`; break;
    case "order": {
      const items = m.order?.product_items ?? [];
      const products = new Map((await getProducts(items.map((i) => i.product_retailer_id))).map((p) => [p.retailer_id, p]));
      cart = items.map((i) => ({ retailer_id: i.product_retailer_id, qty: Math.max(1, Number(i.quantity) || 1) }));
      body = `🛒 Sent a cart from the catalog:\n${items
        .map((i) => `• ${products.get(i.product_retailer_id)?.name ?? i.product_retailer_id} × ${i.quantity} @ ${money(Number(i.item_price), i.currency)}`)
        .join("\n")}${m.order?.text ? `\n${m.order.text}` : ""}`;
      break;
    }
    default: body = `[${m.type} message]`;
  }

  const rowId = await recordInbound({ wamid: m.id, waId, type: m.type, body, mediaId, payload: m, orderId });
  if (rowId === null) return; // a webhook retry - already handled

  if (cart) await updateContact(waId, { cart });

  // "Order now" list pick: one more of that product in the cart, then the assistant confirms.
  const picked = m.interactive?.list_reply?.id?.match(/^add:(.+)$/)?.[1];
  if (picked) {
    const lines = contact.cart.filter((l) => l.retailer_id !== picked);
    const had = contact.cart.find((l) => l.retailer_id === picked)?.qty ?? 0;
    await updateContact(waId, { cart: [...lines, { retailer_id: picked, qty: had + 1 }] });
  }

  // ---- deterministic replies that don't need the model
  const replyId = m.interactive?.list_reply?.id ?? m.interactive?.button_reply?.id;
  if (replyId && (await handleRatingReply(waId, replyId))) return;
  if (m.type === "reaction") return;

  if (!contact.bot_enabled) return; // a person has this chat
  void markReadAndTyping(m.id);
  await enqueueAgent(waId);
}
