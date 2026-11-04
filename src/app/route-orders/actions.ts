"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { one, query } from "@/lib/db";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { CHANNELS, cancelBill, issueBills, validDate } from "@/lib/route-orders/data";

async function editor(key: string) {
  const me = await userFromToken((await cookies()).get("session")?.value);
  return me && atLeast(levelFor(me, key), "edit") ? me : null;
}
const DENIED = "You do not have permission to change this.";
const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null;
const back = (path: string, params: Record<string, string>): never => redirect(`${path}?${new URLSearchParams(params)}`);

export async function issueBillsAction(form: FormData) {
  const date = validDate(text(form, "date") ?? undefined);
  const params = { date };
  const me = await editor("routeorders.billing");
  if (!me) return back("/route-orders/billing", { ...params, error: DENIED });
  const voucherDate = validDate(text(form, "voucherDate") ?? date);
  const startNo = Number(text(form, "startNo"));
  if (!Number.isInteger(startNo) || startNo < 1) return back("/route-orders/billing", { ...params, error: "Give the first bill number." });
  const r = await issueBills(date, voucherDate, startNo, me.name || me.email);
  revalidatePath("/route-orders", "layout");
  return back("/route-orders/billing", r.ok ? { ...params, msg: `Made ${r.count} bills: ${r.first} to ${r.last}. Download the Tally file below.` } : { ...params, error: r.error });
}

export async function cancelBillAction(form: FormData) {
  const date = validDate(text(form, "date") ?? undefined);
  const me = await editor("routeorders.billing");
  if (!me) return back("/route-orders/billing", { date, error: DENIED });
  const r = await cancelBill(Number(text(form, "id")), me.name || me.email);
  revalidatePath("/route-orders", "layout");
  return back("/route-orders/billing", "error" in r ? { date, error: r.error } : { date, msg: `Cancelled ${r.cancelled.join(", ")} and freed the orders. If already imported, cancel in Tally too.` });
}

const MASTERS = "/route-orders/masters";

export async function saveParty(form: FormData) {
  const me = await editor("routeorders.masters");
  if (!me) return back(MASTERS, { tab: "customers", error: DENIED });
  const name = text(form, "name");
  if (!name) return back(MASTERS, { tab: "customers", error: "A customer needs a name." });
  const id = Number(text(form, "id")) || null;
  const channel = (CHANNELS as readonly string[]).includes(text(form, "channel") ?? "") ? text(form, "channel") : "Other";
  const values = [
    name, Number(text(form, "route_id")) || null, channel, text(form, "group_name"), text(form, "tally_ledger"), text(form, "state"),
    text(form, "consignee_name"), text(form, "consignee_address"), text(form, "consignee_state"), text(form, "consignee_pincode"), text(form, "consignee_gstin"),
    text(form, "buyer_address"), text(form, "buyer_gstin"), text(form, "buyer_pincode"), form.get("consolidated") === "on", form.get("active") === "on", text(form, "review_note"),
  ];
  try {
    if (id) {
      await query(
        `update route_order_party set name=$1, route_id=$2, channel=$3, group_name=$4, tally_ledger=$5, state=$6, consignee_name=$7, consignee_address=$8, consignee_state=$9,
           consignee_pincode=$10, consignee_gstin=$11, buyer_address=$12, buyer_gstin=$13, buyer_pincode=$14, consolidated=$15, active=$16, review_note=$17, updated_at=now() where id=$18`,
        [...values, id],
      );
    } else {
      await query(
        `insert into route_order_party (name, route_id, channel, group_name, tally_ledger, state, consignee_name, consignee_address, consignee_state, consignee_pincode, consignee_gstin, buyer_address, buyer_gstin, buyer_pincode, consolidated, active, review_note)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        values,
      );
    }
  } catch {
    return back(MASTERS, { tab: "customers", error: `Another customer is already called ${name}.` });
  }
  revalidatePath("/route-orders", "layout");
  return back(MASTERS, { tab: "customers", msg: `Saved ${name}.` });
}

export async function linkFirm(form: FormData) {
  const me = await editor("routeorders.masters");
  if (!me) return back(MASTERS, { error: DENIED });
  const firm = text(form, "firm");
  const name = text(form, "party");
  const party = name ? await one<{ id: number }>(`select id from route_order_party where lower(name) = lower($1)`, [name]) : null;
  if (!firm || !party) return back(MASTERS, { error: `No customer is called "${name ?? ""}". Pick one from the list.` });
  await query(`update route_order_party set firm_uid = null where firm_uid = $1`, [firm]);
  await query(`update route_order_party set firm_uid = $1, updated_at = now() where id = $2`, [firm, party.id]);
  revalidatePath("/route-orders", "layout");
  return back(MASTERS, { msg: `Linked to ${name}.` });
}

export async function saveProduct(form: FormData) {
  const me = await editor("routeorders.masters");
  if (!me) return back(MASTERS, { tab: "products", error: DENIED });
  const id = Number(text(form, "id"));
  const name = text(form, "name");
  const pack = Number(text(form, "pack_size"));
  const gst = Number(text(form, "gst_pct"));
  if (!id || !name || !(pack > 0) || ![0, 5].includes(gst)) return back(MASTERS, { tab: "products", error: "Name, a pack size above 0 and GST of 0 or 5 are needed." });
  await query(
    `update route_order_product set name=$1, category=$2, tally_item=$3, tally_ledger=$4, tally_unit=$5, pack_size=$6, gst_pct=$7, shelf_days=$8, weight_kg=$9, stock_id=$10 where id=$11`,
    [name, text(form, "category") ?? "Other", text(form, "tally_item"), text(form, "tally_ledger"), text(form, "tally_unit"), pack, gst, Number(text(form, "shelf_days")) || 0, Number(text(form, "weight_kg")) || 0, text(form, "stock_id"), id],
  );
  revalidatePath("/route-orders", "layout");
  return back(MASTERS, { tab: "products", msg: `Saved ${name}.` });
}
