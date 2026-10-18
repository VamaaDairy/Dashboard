import { Network } from "lucide-react";
import type { MasterDef } from "../types";
import { REF_CHANNELS } from "../refs";

/** Route: /orders/channelMaster */
export const channels: MasterDef = {
  slug: "channelMaster",
  title: "Channels",
  subtitle: "The sales channels and the chain between them: company, super stockist, distributor, retail.",
  icon: Network,
  from: `fp_channel c left join fp_channel pc on pc.uid = c.parent_channel_uid left join fp_firm f on f.channel_uid = c.uid`,
  groupBy: "c.uid, pc.channel",
  cols: [
    { key: "name", label: "Channel", expr: "c.channel" },
    { key: "code", label: "Code", expr: "c.channel_code", kind: "mono" },
    { key: "level", label: "Level", expr: "c.level", kind: "num" },
    { key: "parent", label: "Supplied by", expr: "pc.channel" },
    { key: "customers", label: "Customers", expr: "count(f.uid)::int", kind: "num" },
    { key: "active", label: "Active", expr: "(count(f.uid) filter (where f.active = 1))::int", kind: "num" },
  ],
  search: ["c.channel", "c.channel_code"],
  order: "c.level, c.channel",

  entity: {
    table: "fp_channel", idCol: "uid", idExpr: "c.uid", noun: "channel",
    defaults: { auto_accept: 0 },
    usage: [
      { label: "customers", sql: "select count(*)::int as n from fp_firm where channel_uid = $1" },
      { label: "channel prices", sql: "select count(*)::int as n from fp_channel_rate where channel_uid = $1" },
      { label: "sub-channels", sql: "select count(*)::int as n from fp_channel where parent_channel_uid = $1" },
    ],
    fields: [
      { name: "channel", label: "Channel", type: "text", required: true, upper: true },
      { name: "channel_code", label: "Code", type: "text", required: true, upper: true, lockOnEdit: true, help: "Unique. Cannot be changed later." },
      { name: "level", label: "Level", type: "number", required: true, min: 1, max: 9, help: "1 is the company, higher levels are further down the chain." },
      { name: "parent_channel_uid", label: "Supplied by", type: "ref", ref: REF_CHANNELS },
      { name: "retail", label: "Retail channel", type: "bool" },
    ],
  },
};
