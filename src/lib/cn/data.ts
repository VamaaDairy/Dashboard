import { query, one } from "@/lib/db";

export interface Complaint {
  id: string;
  complaint_no: string;
  stage: string;
  stage_on: string;
  outcome: string | null;
  complaint_date: string;
  customer_name: string;
  customer_type: string;
  region: string | null;
  contact_no: string | null;
  invoice_no: string;
  invoice_date: string | null;
  product_name: string;
  /** the Product Master product (db/110), when known */
  sku_no: number | null;
  product_image: string | null;
  batch_no: string | null;
  qty_affected: number;
  qty_unit: string;
  category: string;
  description: string;
  evidence_url: string;
  claim_value: number;
  registered_by: string;
  created_at: string;
  mis_by: string | null; mis_on: string | null; mis_remark: string | null;
  department: string | null; assigned_by: string | null; assigned_on: string | null; tat_due: string | null;
  investigation: string | null; root_cause: string | null; corrective_action: string | null; preventive_action: string | null;
  capa_owner: string | null; capa_target_date: string | null; rca_by: string | null; rca_on: string | null;
  recommended_value: number | null; return_required: boolean; recommend_remark: string | null;
  recommended_by: string | null; recommended_on: string | null;
  approval_level: string | null; approver_level: string | null; approved_value: number | null;
  approved_by: string | null; approved_on: string | null; approval_remark: string | null;
  cn_number: string | null; cn_date: string | null; cn_value: number | null; finance_by: string | null; finance_on: string | null;
  return_verified_by: string | null; return_verified_on: string | null; return_remark: string | null;
  closed_by: string | null; closed_on: string | null; closure_remark: string | null;
  capa_effective: boolean | null; capa_review_by: string | null; capa_review_on: string | null; capa_review_remark: string | null;
  /** where it was raised (dashboard, d2c, distributor, salesforce) and the order it is about */
  source: "dashboard" | "d2c" | "distributor" | "salesforce";
  shop_order_id: number | null; shop_order_no: string | null; booking_order_uid: string | null; booking_order_id: number | null; firm_uid: string | null;
  items: Array<{ sku: string; name: string; qty: number; unitPrice: number; value: number }> | null;
  photo_ids: number[];
  /** D2C complaints end with a refund instead of a credit note */
  refund_value: number | null; refund_mode: string | null; refund_ref: string | null; refund_on: string | null; refund_by: string | null;
}

export interface CnEvent { id: string; at: string; by_name: string; action: string; remark: string | null }

/** Date columns come back as YYYY-MM-DD text (the app's calendar), not JS Dates. */
const DATES = [
  "stage_on", "complaint_date", "invoice_date", "mis_on", "assigned_on", "tat_due", "capa_target_date", "rca_on",
  "recommended_on", "approved_on", "cn_date", "finance_on", "return_verified_on", "closed_on", "capa_review_on", "refund_on",
];
const PLAIN = [
  "id", "complaint_no", "stage", "outcome", "customer_name", "customer_type", "region", "contact_no", "invoice_no", "product_name",
  "batch_no", "qty_affected", "qty_unit", "category", "description", "evidence_url", "claim_value", "registered_by",
  "mis_by", "mis_remark", "department", "assigned_by", "investigation", "root_cause", "corrective_action", "preventive_action",
  "capa_owner", "rca_by", "recommended_value", "return_required", "recommend_remark", "recommended_by", "approval_level",
  "approver_level", "approved_value", "approved_by", "approval_remark", "cn_number", "cn_value", "finance_by",
  "return_verified_by", "return_remark", "closed_by", "closure_remark", "capa_effective", "capa_review_by", "capa_review_remark",
  "source", "shop_order_id", "booking_order_uid", "firm_uid", "items", "refund_value", "refund_mode", "refund_ref", "refund_by", "sku_no",
];
const COLUMNS = [
  ...PLAIN.map((c) => `c.${c}`),
  ...DATES.map((c) => `to_char(c.${c}, 'YYYY-MM-DD') as ${c}`),
  "c.created_at::text as created_at",
  "(select o.order_no from shop_order o where o.id = c.shop_order_id) as shop_order_no",
  "(select b.order_id from fp_booking_order b where b.uid = c.booking_order_uid) as booking_order_id",
  "coalesce((select array_agg(p.id order by p.id) from cn_photo p where p.complaint_id = c.id), '{}') as photo_ids",
  // the Product Master's photo of the product (db/110: sku_no), the same one every page shows
  "(select l.image from product_label l where l.sku_no = c.sku_no order by l.sku_code ~ '^[0-9]+$' desc limit 1) as product_image",
].join(", ");

export const listComplaints = () =>
  query<Complaint>(`select ${COLUMNS} from cn_complaint c order by c.complaint_date desc, c.created_at desc`);

export const getComplaint = (id: string) =>
  /^[0-9a-f-]{36}$/i.test(id) ? one<Complaint>(`select ${COLUMNS} from cn_complaint c where c.id = $1`, [id]) : Promise.resolve(null);

export const listEvents = (id: string) =>
  query<CnEvent>(`select id, at::text as at, by_name, action, remark from cn_event where complaint_id = $1 order by at, id`, [id]);

/** Newer complaints on the same product and category, within the window, are repeats of an earlier one. */
export function repeatsOf(all: Complaint[], c: Complaint, windowDays: number): Complaint[] {
  const t0 = Date.parse(`${c.complaint_date}T00:00:00Z`);
  return all.filter((o) => {
    if (o.id === c.id || o.stage === "rejected") return false;
    if (o.product_name !== c.product_name || o.category !== c.category) return false;
    const dt = (Date.parse(`${o.complaint_date}T00:00:00Z`) - t0) / 86400000;
    return dt > 0 && dt <= windowDays;
  });
}
