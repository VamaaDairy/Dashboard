import "server-only";
import { query } from "@/lib/db";
import { activeScenarioId } from "@/lib/model/load";
import { labelOf, looksDifferent, productLabels, skuNo, type ProductLabel } from "@/lib/products/names";

/**
 * Every SKU number any list uses, side by side: the one product name (Product Master / D2C app) and what the
 * production SKU list, the route-orders product list and the WhatsApp catalog call it. A list whose name looks
 * like a different product for the same number is a clash: someone has to fix that list's SKU code.
 */
export interface NameCheckRow {
  skuNo: number;
  label: ProductLabel;
  inMaster: boolean;
  production: string | null;
  route: string | null;
  whatsapp: string | null;
  /** which lists name another product for this number */
  clashes: string[];
}

export async function nameCheck(): Promise<NameCheckRow[]> {
  const [labels, production, route, whatsapp] = await Promise.all([
    productLabels(),
    query<{ code: string; name: string }>(`select distinct on (code) coalesce(master_sku_no::text, code) as code, name from sku where scenario_id = $1 order by code, is_active desc`, [await activeScenarioId()]),
    query<{ code: string; name: string }>(`select sku_no::text as code, name from route_order_product`),
    query<{ code: string; name: string }>(`select retailer_id as code, name from wa_product where active`),
  ]);
  const rows = new Map<number, NameCheckRow>();
  const row = (n: number) => {
    let r = rows.get(n);
    if (!r) {
      const l = labels.get(n);
      r = { skuNo: n, label: l ?? labelOf(labels, n), inMaster: !!l, production: null, route: null, whatsapp: null, clashes: [] };
      rows.set(n, r);
    }
    return r;
  };
  for (const n of labels.keys()) row(n);
  const add = (list: Array<{ code: string; name: string }>, key: "production" | "route" | "whatsapp", title: string) => {
    for (const x of list) {
      const n = skuNo(x.code);
      if (n === null) continue;
      const r = row(n);
      r[key] = x.name;
      if (!r.inMaster) r.label = labelOf(labels, x.code, x.name); // nothing better to show than this list's own
      else if (looksDifferent(x.name, r.label.name)) r.clashes.push(title);
    }
  };
  add(production, "production", "Production SKU list");
  add(route, "route", "Route orders list");
  add(whatsapp, "whatsapp", "WhatsApp catalog");
  return [...rows.values()].sort((a, b) => b.clashes.length - a.clashes.length || Number(a.inMaster) - Number(b.inMaster) || a.skuNo - b.skuNo);
}
