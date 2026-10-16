import { query } from "@/lib/db";
import { SIDEBAR } from "./model";

/**
 * Settings screens that edit one JSON column of a channel or a designation:
 * a few typed fields ("object"), or on/off switches ("flags").
 */
export type FieldType = "number" | "text" | "textarea" | "select" | "check";
export interface CfgField { key: string; label: string; type: FieldType; options?: string[]; hint?: string }
export interface Flag { key: string; label: string }
export interface ConfigDef {
  route: string; title: string; subtitle: string; entity: "channel" | "designation"; column: string;
  mode: "object" | "flags"; fields?: CfgField[]; flags?: Flag[]; custom?: boolean;
}

const words = (k: string) => k.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());

/** Every page key the portal's sidebar tests with hasPermission(...). */
export function pageKeys(): Flag[] {
  const keys = new Set<string>();
  for (const g of SIDEBAR.groups) for (const it of g.items) for (const m of it.visible.matchAll(/has(?:Designation|Channel)?Permission\("(\w+)"\)/g)) keys.add(m[1]);
  // button-level keys named in the spec
  for (const k of ["assignButton", "modifyRouteButton", "resetMobile", "bulkUpdateRoute"]) keys.add(k);
  return [...keys].sort().map((k) => ({ key: k, label: words(k) }));
}

const CUSTOMER_FIELDS = ["name", "firmCode", "email", "phone", "landline", "pan", "gstin", "market", "state", "city", "cluster", "district", "pincode", "address", "contactPerson", "creditLimit", "licenseNo", "latitude", "longitude", "channel", "beat", "salesContact"];
const toFlags = (keys: string[]): Flag[] => keys.map((k) => ({ key: k, label: words(k) }));

export const CONFIGS: Record<string, ConfigDef> = {
  channelConfiguration: {
    route: "channelConfiguration", title: "Channel Configuration", subtitle: "What a channel's users must do in the app.", entity: "channel", column: "channel_configuration", mode: "object",
    fields: [{ key: "minMandatoryPhotos", label: "Minimum Mandatory Photos", type: "number", hint: "Photos required on a customer visit." }],
  },
  channelEditConfiguration: {
    route: "channelEditConfiguration", title: "Channel Edit Configuration", subtitle: "Which customer fields this designation may edit.", entity: "designation", column: "edit_customer_permission", mode: "flags", flags: toFlags(CUSTOMER_FIELDS),
  },
  channelVisibilityConfiguration: {
    route: "channelVisibilityConfiguration", title: "Customer Field Visibility", subtitle: "Which customer fields this channel shows.", entity: "channel", column: "channel_visibility", mode: "flags", flags: toFlags(CUSTOMER_FIELDS),
  },
  collectionConfiguration: {
    route: "collectionConfiguration", title: "Collection Configuration", subtitle: "When overdue dues are flagged for a channel.", entity: "channel", column: "due_notification", mode: "object",
    fields: [
      { key: "dueAge", label: "Due Age In Days", type: "number" }, { key: "dueAmount", label: "Due Amount", type: "number" },
      { key: "triggerOn", label: "Trigger On", type: "select", options: ["Invoice date", "Last payment date"] },
    ],
  },
  channelBillingConfiguration: {
    route: "channelBillingConfiguration", title: "Channel Billing Configuration", subtitle: "How this channel's invoices print.", entity: "channel", column: "billing_template", mode: "object",
    fields: [{ key: "printSize", label: "Print Size", type: "select", options: ["A4", "A5", "Thermal 80 mm"] }, { key: "terms", label: "Terms & Condition", type: "textarea" }],
  },
  eodReportConfiguration: {
    route: "eodReportConfiguration", title: "EOD Report Configuration", subtitle: "What the end-of-day report contains.", entity: "channel", column: "eod_report_configuration", mode: "flags",
    flags: toFlags(["attendance", "visits", "orders", "collections", "expenses", "newOutlets", "stock"]),
  },
  orderShareConfiguration: {
    route: "orderShareConfiguration", title: "Order Share Configuration", subtitle: "Where a confirmed order is sent.", entity: "channel", column: "order_share_configuration", mode: "flags",
    flags: toFlags(["whatsapp", "email", "sms", "pdfAttachment"]),
  },
  promoterDayEndSummaryConfiguration: {
    route: "promoterDayEndSummaryConfiguration", title: "Promoter Day End Summary Configuration", subtitle: "What a promoter's day-end summary shows.", entity: "channel", column: "promoter_day_end_summary_configuration", mode: "flags",
    flags: toFlags(["sales", "stock", "attendance", "targetVsAchievement", "damages"]),
  },
  configChannel: {
    route: "configChannel", title: "Usage Module Channels", subtitle: "App modules switched on for a channel.", entity: "channel", column: "footprints_permission", mode: "flags", custom: true,
    flags: toFlags(["attendance", "orderBooking", "collection", "expense", "displayAudit", "stockAudit", "taskManagement", "leave", "catalogue", "quiz"]),
  },
  configDesignations: {
    route: "configDesignations", title: "Usage Module Designations", subtitle: "App modules switched on for a designation.", entity: "designation", column: "footprints_permission", mode: "flags", custom: true,
    flags: toFlags(["attendance", "orderBooking", "collection", "expense", "displayAudit", "stockAudit", "taskManagement", "leave", "catalogue", "quiz"]),
  },
};

export function configFor(route: string): ConfigDef | null {
  if (route === "pagePermission") {
    return { route, title: "Page Permissions", subtitle: "Pages and buttons a designation can use.", entity: "designation", column: "page_permission", mode: "flags", flags: pageKeys(), custom: true };
  }
  return CONFIGS[route] ?? null;
}

export async function configRecords(def: ConfigDef) {
  const label = def.entity === "channel" ? "channel" : "designation";
  return query<{ id: string; label: string }>(`select uid::text as id, ${label} as label from fp_${def.entity} order by 2`);
}

export async function loadConfig(def: ConfigDef, id: string): Promise<Record<string, unknown>> {
  const r = await query<{ v: unknown }>(`select ${def.column} as v from fp_${def.entity} where uid = $1`, [id]);
  const v = r[0]?.v;
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export async function saveConfig(def: ConfigDef, id: string, value: Record<string, unknown>): Promise<void> {
  const clean: Record<string, unknown> = {};
  if (def.mode === "flags") {
    for (const [k, v] of Object.entries(value)) {
      if (!/^[A-Za-z][A-Za-z0-9_]{0,60}$/.test(k)) throw new Error(`"${k}" is not a valid key`);
      if (!def.custom && !def.flags!.some((f) => f.key === k)) continue;
      clean[k] = v === true;
    }
  } else {
    for (const f of def.fields!) {
      const v = value[f.key];
      if (v === undefined || v === "" || v === null) continue;
      if (f.type === "number") { const n = Number(v); if (!Number.isFinite(n) || n < 0) throw new Error(`${f.label}: enter a number`); clean[f.key] = n; }
      else if (f.type === "check") clean[f.key] = v === true;
      else if (f.type === "select") { if (!f.options!.includes(String(v))) throw new Error(`${f.label}: not an option`); clean[f.key] = String(v); }
      else clean[f.key] = String(v);
    }
  }
  const res = await query(`update fp_${def.entity} set ${def.column} = $2::jsonb, updated_at = now() where uid = $1 returning uid`, [id, JSON.stringify(clean)]);
  if (!res.length) throw new Error("That record no longer exists");
}
