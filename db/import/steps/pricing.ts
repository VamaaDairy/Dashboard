/** Prices: channel margins (fp_channel_rate) and slab price lists (fp_slab, fp_slab_rate). Both look products up by SKU. */
import { uid } from "../lib/ids";
import { code, dateOnly, flag, list, num, stamp, str } from "../lib/parse";
import { adminStaff, lookup, upsert } from "../lib/sql";
import type { Row, Step } from "../types";

const who = (name: unknown, email: unknown, at: unknown) =>
  str(name) || str(email) ? { name: str(name), email: str(email), at: str(at) } : null;

export const loadChannelRates: Step = async (ctx) => {
  const rates = ctx.reports.rates;
  if (!rates.length) return;
  const skus = await lookup(ctx, `select sku_code k, uid v from fp_product`);
  const channels = await lookup(ctx, `select upper(channel) k, uid v from fp_channel`);

  const rows: Row[] = [];
  for (const r of rates) {
    const channel = channels.get(str(r["Channel"])?.toUpperCase() ?? "");
    const sku = code(r["SKU Code"]);
    const product = sku ? skus.get(sku) : undefined;
    if (!channel || !product) { ctx.warn.push(`channel price skipped (unknown channel or SKU): ${str(r["Channel"])} / ${str(r["SKU Name"])}`); continue; }
    const state = str(r["State"])?.toUpperCase() ?? null;
    const from = dateOnly(r["FROM DATE"]);
    rows.push({
      uid: uid(`rate:${channel}|${sku}|${state ?? ""}|${from ?? ""}`), channel_uid: channel, product_uid: product, sku_code: sku, state_state: state,
      dealer_price: num(r["Dealer Price"]) ?? 0, margin: num(r["Margin"]), selling_price: num(r["Selling Price"]) ?? 0,
      from_date: from, to_date: dateOnly(r["TO DATE"]), division_name: str(r["DIVISION NAME"]),
      customer_class: list(r["CUSTOMER CLASS"]), customer_type: list(r["CUSTOMER TYPE"]), chain: str(r["CHAIN"]),
      updated_by: {
        current: who(r["UPDATED BY EMPLOYEE NAME (CURRENT)"], r["UPDATED BY EMPLOYEE EMAIL (CURRENT)"], r["UPDATED DATE AND TIME (CURRENT)"]),
        before: who(r["UPDATED BY EMPLOYEE NAME (BEFORE)"], r["UPDATED BY EMPLOYEE EMAIL (BEFORE)"], r["UPDATED DATE AND TIME (BEFORE)"]),
        previous: who(r["UPDATED BY EMPLOYEE NAME (PREVIOUS)"], r["UPDATED BY EMPLOYEE EMAIL (PRIVIOUS)"], r["UPDATED DATE AND TIME (PRIVIOUS)"]),
      },
    });
  }
  ctx.summary.push(`channel prices ${await upsert(ctx, "fp_channel_rate", rows)}`);
};

export const loadSlabs: Step = async (ctx) => {
  const slabs = ctx.reports.slabs;
  if (!slabs.length) return;
  const owner = await adminStaff(ctx);
  if (!owner) throw new Error("Slabs need an employee to own them - import EMPLOYEE_MASTER first.");
  const skus = await lookup(ctx, `select sku_code k, uid v from fp_product`);

  // a slab is active if any of its rows is
  const names = new Map<string, boolean>();
  for (const r of slabs) {
    const n = str(r["Slab Name"]);
    if (n) names.set(n, (names.get(n) ?? false) || flag(r["Status"]) === 1);
  }
  await upsert(ctx, "fp_slab", [...names].map(([name, on]) => ({
    uid: uid(`slab:${name}`), name, active: on ? 1 : 0, created_staff_uid: owner, updated_staff_uid: owner,
  })));

  const rows: Row[] = [];
  for (const r of slabs) {
    const name = str(r["Slab Name"]);
    const sku = code(r["SKU Code"]);
    const product = sku ? skus.get(sku) : undefined;
    if (!name || !product) { ctx.warn.push(`slab rate skipped (unknown SKU): ${name} / ${str(r["Product Name"])}`); continue; }
    rows.push({
      uid: uid(`slabrate:${name}|${sku}`), slab_uid: uid(`slab:${name}`), product_uid: product,
      sp: num(r["Selling Price"]) ?? 0, dp: num(r["Dealer Price"]) ?? 0, max_allowed_discount: num(r["Max Allowed Discount"]) ?? 0,
      from_date: stamp(r["Effective From Date"]), active: flag(r["Status"]),
    });
  }
  ctx.summary.push(`slabs ${names.size}, slab rates ${await upsert(ctx, "fp_slab_rate", rows)}`);
};
