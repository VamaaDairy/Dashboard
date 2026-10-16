import { Percent } from "lucide-react";
import type { MasterDef } from "../types";
import { REF_CHANNELS, REF_PRODUCTS, REF_STATES } from "../refs";

/** Route: /orders/fpchannelrates */
export const channelRates: MasterDef = {
  slug: "fpchannelrates",
  title: "Channel Margins",
  subtitle: "Selling price by channel and product, with the dates it applies and who last changed it.",
  icon: Percent,
  from: `fp_channel_rate r join fp_channel c on c.uid = r.channel_uid join fp_product p on p.uid = r.product_uid`,
  cols: [
    { key: "channel", label: "Channel", expr: "c.channel" },
    { key: "sku", label: "SKU", expr: "p.sku_code", kind: "mono" },
    { key: "product", label: "Product", expr: "p.sku_name" },
    { key: "mrp", label: "MRP", expr: "p.mrp", kind: "money" },
    { key: "dp", label: "Dealer price", expr: "r.dealer_price", kind: "money" },
    { key: "margin", label: "Margin", expr: "r.margin", kind: "num" },
    { key: "sp", label: "Selling price", expr: "r.selling_price", kind: "money" },
    { key: "state", label: "State", expr: "r.state_state" },
    { key: "from", label: "From", expr: "r.from_date", kind: "mono" },
    { key: "to", label: "To", expr: "r.to_date", kind: "mono" },
    { key: "by", label: "Last updated by", expr: "r.updated_by #>> '{current,name}'" },
    { key: "at", label: "Updated at", expr: "r.updated_by #>> '{current,at}'", kind: "mono" },
  ],
  search: ["c.channel", "p.sku_code", "p.sku_name"],
  filters: [{ key: "channel", label: "Channel", expr: "c.channel" }],
  order: "c.channel, p.sku_name",

  entity: {
    table: "fp_channel_rate", idCol: "uid", idExpr: "r.uid", noun: "channel price",
    fields: [
      { name: "channel_uid", label: "Channel", type: "ref", ref: REF_CHANNELS, required: true },
      { name: "product_uid", label: "Product", type: "ref", ref: REF_PRODUCTS, required: true },
      { name: "dealer_price", label: "Dealer price", type: "number", required: true, min: 0 },
      { name: "margin", label: "Margin", type: "number" },
      { name: "selling_price", label: "Selling price", type: "number", required: true, min: 0 },
      { name: "state_state", label: "State", type: "ref", ref: REF_STATES, help: "Leave empty for all states." },
      { name: "from_date", label: "From", type: "date" },
      { name: "to_date", label: "To", type: "date" },
    ],
  },
};
