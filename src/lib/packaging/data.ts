import "server-only";
import { query } from "@/lib/db";
import { activeScenarioId } from "@/lib/model/load";

/** One packaging master item: its rate and the particulars behind it. */
export interface PackagingRow {
  id: string;
  name: string;
  unit: string | null;
  rate: number;                // what the cost model reads: per unit, GST and freight in
  category: string | null;
  spec: string | null;
  supplier: string | null;
  base_rate: number | null;    // per unit before GST; when set, rate = base x (1 + GST %) + freight
  gst_pct: number;
  freight: number;
  note: string | null;
  used_in: string[];           // SKU names whose packing list has this item
}

export async function getPackagingMaster(): Promise<PackagingRow[]> {
  const scenario = await activeScenarioId();
  const rows = await query<Omit<PackagingRow, "used_in">>(
    `select o.id, o.name,
            max(coalesce(v.computed_text, v.input_text)) filter (where v.field_key = 'unit') as unit,
            coalesce(max(coalesce(v.computed_num, v.input_num)) filter (where v.field_key = 'rate'), 0) as rate,
            d.category, d.spec, d.supplier, d.base_rate, coalesce(d.gst_pct, 0) as gst_pct, coalesce(d.freight, 0) as freight, d.note
       from cost_object o
       join object_class k on k.id = o.class_id and k.code = 'packaging'
       left join v_cell v on v.object_id = o.id
       left join packaging_detail d on d.packaging_id = o.id
      where o.scenario_id = $1 and o.is_active
      group by o.id, o.name, d.category, d.spec, d.supplier, d.base_rate, d.gst_pct, d.freight, d.note
      order by coalesce(d.category, 'zzz'), o.name`,
    [scenario],
  );
  const used = await query<{ packaging_id: string; name: string }>(
    `select distinct i.packaging_id, s.name from sku_packing_item i join sku s on s.id = i.sku_id
      where s.scenario_id = $1 order by s.name`, [scenario]);
  const by = new Map<string, string[]>();
  for (const u of used) by.set(u.packaging_id, [...(by.get(u.packaging_id) ?? []), u.name]);
  return rows.map((r) => ({
    ...r, rate: Number(r.rate), base_rate: r.base_rate === null ? null : Number(r.base_rate),
    gst_pct: Number(r.gst_pct), freight: Number(r.freight), used_in: by.get(r.id) ?? [],
  }));
}
