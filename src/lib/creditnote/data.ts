import { query, one } from "@/lib/db";
import { activeScenarioId } from "@/lib/model/load";

export type CreditStatus = "pending" | "approved" | "rejected";

export interface CreditItem {
  id: string;
  material_name: string;
  reason: string | null;
  mfd: string | null;
  ubd: string | null;
  return_unit: string;
  pcs_per_case: number;
  sku_code: string | null;
  claim_qty: number | null;
  approved_qty: number | null;
  quality_remark: string | null;
}

export interface CreditNote {
  id: string;
  challan_no: string;
  challan_date: string;
  customer_name: string;
  contact_no: string | null;
  address: string | null;
  checked_by: string | null;
  vehicle_no: string | null;
  dispatch_challan_no: string | null;
  dispatch_date: string | null;
  team_name: string | null;
  status: CreditStatus;
  approved_by: string | null;
  approved_on: string | null;
  decision_note: string | null;
  created_by: string | null;
  created_at: string;
  items: CreditItem[];
}

const COLUMNS = `n.id, n.challan_no, to_char(n.challan_date, 'YYYY-MM-DD') as challan_date, n.customer_name, n.contact_no,
  n.address, n.checked_by, n.vehicle_no, n.dispatch_challan_no, to_char(n.dispatch_date, 'YYYY-MM-DD') as dispatch_date,
  n.team_name, n.status, n.approved_by, to_char(n.approved_on, 'YYYY-MM-DD') as approved_on, n.decision_note, n.created_by,
  n.created_at::text as created_at,
  coalesce((select json_agg(json_build_object(
      'id', i.id, 'material_name', i.material_name, 'reason', i.reason, 'mfd', to_char(i.mfd, 'YYYY-MM-DD'), 'ubd', to_char(i.ubd, 'YYYY-MM-DD'),
      'return_unit', i.return_unit, 'pcs_per_case', i.pcs_per_case, 'sku_code', i.sku_code, 'claim_qty', i.claim_qty::float8, 'approved_qty', i.approved_qty::float8,
      'quality_remark', i.quality_remark) order by i.position)
    from credit_note_item i where i.credit_note_id = n.id), '[]'::json) as items`;

export const listCreditNotes = () =>
  query<CreditNote>(`select ${COLUMNS} from credit_note n order by n.challan_date desc, n.created_at desc`);

export const getCreditNote = (id: string) =>
  /^[0-9a-f-]{36}$/i.test(id)
    ? one<CreditNote>(`select ${COLUMNS} from credit_note n where n.id = $1`, [id])
    : Promise.resolve(null);

export interface SkuOption { code: string; name: string; category: string; case_unit: string; pcs_per_case: number }

/** The SKU list (active ones, in the stock app's order) - what the item name is picked from. */
export async function listSkuOptions(): Promise<SkuOption[]> {
  return query<SkuOption>(
    `select code, name, category, case_unit, pcs_per_case from sku where scenario_id = $1 and is_active order by sort_order, name`,
    [await activeScenarioId()],
  );
}
