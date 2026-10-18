import { MAX_LINE_QTY, MAX_LINES } from "./pricing";
import type { OrderInput } from "./orders";

export type Parsed = { ok: true; input: OrderInput } | { ok: false; error: string; fields?: Record<string, string> };

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Reads the JSON body the app sends and checks every part of it. Nothing here is trusted. */
export function parseOrderBody(body: unknown): Parsed {
  if (!body || typeof body !== "object") return { ok: false, error: "Send the order as a JSON object." };
  const b = body as Record<string, unknown>;

  const fields: Record<string, string> = {};
  const name = str(b.name, 80);
  const address = str(b.address, 300);
  const digits = str(b.phone, 20).replace(/\D/g, "");
  const phone = digits.length > 10 ? digits.slice(-10) : digits;
  const pincode = str(b.pincode, 10).replace(/\D/g, "");
  const notes = str(b.notes, 200);
  const lat = typeof b.lat === "number" && Math.abs(b.lat) <= 90 ? b.lat : null;
  const lng = typeof b.lng === "number" && Math.abs(b.lng) <= 180 ? b.lng : null;

  if (name.length < 2) fields.name = "Please enter your name";
  if (!/^[6-9]\d{9}$/.test(phone)) fields.phone = "Enter a valid 10-digit mobile number";
  if (address.length < 10) fields.address = "Please enter your full delivery address";
  if (pincode && pincode.length !== 6) fields.pincode = "Pincode must be 6 digits";

  const lines: OrderInput["lines"] = [];
  if (!Array.isArray(b.lines) || b.lines.length === 0) {
    fields.lines = "Your cart is empty";
  } else if (b.lines.length > MAX_LINES) {
    fields.lines = "Too many different items in one order";
  } else {
    for (const l of b.lines) {
      const sku = str((l as { sku?: unknown })?.sku, 60);
      const qty = Number((l as { qty?: unknown })?.qty);
      if (!sku || !Number.isInteger(qty) || qty < 1 || qty > MAX_LINE_QTY) {
        fields.lines = `Each item needs a product and a quantity from 1 to ${MAX_LINE_QTY}`;
        break;
      }
      lines.push({ sku, qty });
    }
  }

  if (Object.keys(fields).length) return { ok: false, error: "Please check the highlighted details.", fields };
  return { ok: true, input: { name, phone, address, pincode: pincode || null, notes: notes || null, lat: lat !== null && lng !== null ? lat : null, lng: lat !== null && lng !== null ? lng : null, lines } };
}
