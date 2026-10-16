import { query } from "@/lib/db";

/* "AI" here is plain statistics and string matching over the data in the database - nothing leaves the server. */

export interface Suggestion { sku: string; name: string; qty: number; reason: string }

export async function suggestOrder(customerId: string): Promise<{ mode: "repeat" | "new"; customer: string; items: Suggestion[] } | null> {
  const [c] = await query<{ name: string; city: string | null; channel_id: string | null }>(
    `select name, city, channel_id from ord_customer where id = $1`, [customerId]);
  if (!c) return null;

  const hist = await query<{ sku: string; name: string; orders: number; avg_qty: number; days_since: number; gap: number | null }>(
    `select p.sku, p.name, count(distinct o.id)::int as orders, avg(i.qty) as avg_qty,
            (current_date - max(o.order_date))::int as days_since,
            case when count(distinct o.order_date) > 1
                 then ((max(o.order_date) - min(o.order_date))::numeric / (count(distinct o.order_date) - 1)) end as gap
       from ord_order_item i join ord_order o on o.id = i.order_id and o.status <> 'cancelled'
       join ord_product p on p.id = i.product_id
      where o.customer_id = $1 and o.order_date >= current_date - 120 and p.is_active
      group by p.id order by orders desc, avg_qty desc`, [customerId]);

  if (hist.length) {
    const items = hist.map((h) => {
      const gap = h.gap === null ? 14 : Math.max(3, Number(h.gap));
      const due = h.days_since >= gap * 0.8;
      return {
        sku: h.sku, name: h.name, qty: Math.max(1, Math.round(Number(h.avg_qty))), due,
        reason: due
          ? `Usually every ${Math.round(gap)} days - last ordered ${h.days_since} days ago`
          : `Ordered ${h.orders}× recently (last ${h.days_since} days ago)`,
      };
    });
    const due = items.filter((i) => i.due);
    return { mode: "repeat", customer: c.name, items: (due.length ? due : items.slice(0, 5)).map((i) => ({ sku: i.sku, name: i.name, qty: i.qty, reason: i.reason })) };
  }

  // no history: what similar outlets (same channel, else everyone) buy most
  const popular = await query<{ sku: string; name: string; outlets: number; qty: number }>(
    `select p.sku, p.name, count(distinct o.customer_id)::int as outlets, percentile_cont(0.5) within group (order by i.qty) as qty
       from ord_order_item i join ord_order o on o.id = i.order_id and o.status <> 'cancelled' and o.kind = 'secondary'
       join ord_customer c on c.id = o.customer_id and ($1::uuid is null or c.channel_id = $1)
       join ord_product p on p.id = i.product_id and p.is_active
      where o.order_date >= current_date - 90 group by p.id order by outlets desc, qty desc limit 6`, [c.channel_id]);
  return {
    mode: "new", customer: c.name,
    items: popular.map((p) => ({ sku: p.sku, name: p.name, qty: Math.max(1, Math.round(Number(p.qty))), reason: `Bought by ${p.outlets} similar outlet${p.outlets === 1 ? "" : "s"}` })),
  };
}

// ---- dealer de-duplication ---------------------------------------------
const STOP = new Set(["store", "stores", "traders", "trader", "general", "the", "and", "enterprises", "enterprise", "agency", "agencies", "distributors", "distributor", "mart", "shop"]);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((t) => t && !STOP.has(t));

function lev(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)] as number[]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

export interface DupPair { a: { id: string; code: string; name: string; city: string | null }; b: { id: string; code: string; name: string; city: string | null }; score: number; why: string }

export async function dedupCandidates(): Promise<DupPair[]> {
  const rows = await query<{ id: string; code: string; name: string; city: string | null; phone: string | null; gst_no: string | null }>(
    `select id, code, name, city, phone, gst_no from ord_customer where status <> 'inactive' order by name limit 3000`);
  const prep = rows.map((r) => ({ r, key: norm(r.name).join(" "), toks: new Set(norm(r.name)), phone: (r.phone ?? "").replace(/\D/g, "").slice(-10), gst: (r.gst_no ?? "").trim().toUpperCase() }));
  const out: DupPair[] = [];
  for (let i = 0; i < prep.length; i++) {
    for (let j = i + 1; j < prep.length; j++) {
      const a = prep[i], b = prep[j];
      let score = 0, why = "";
      if (a.gst && a.gst === b.gst) { score = 1; why = "Same GSTIN"; }
      else if (a.phone.length >= 10 && a.phone === b.phone) { score = 0.95; why = "Same phone"; }
      else if (a.key && b.key) {
        const inter = [...a.toks].filter((t) => b.toks.has(t)).length;
        const jac = inter / (a.toks.size + b.toks.size - inter || 1);
        const sim = 1 - lev(a.key, b.key) / Math.max(a.key.length, b.key.length);
        const best = Math.max(jac, sim);
        if (best >= 0.8 && (!a.r.city || !b.r.city || a.r.city === b.r.city)) { score = best; why = `Similar name${a.r.city && a.r.city === b.r.city ? " in " + a.r.city : ""}`; }
      }
      if (score > 0) out.push({ a: a.r, b: b.r, score: Math.round(score * 100) / 100, why });
    }
  }
  return out.sort((x, y) => y.score - x.score).slice(0, 200);
}

// ---- shelf watch --------------------------------------------------------
export interface ShelfRow { id: string; name: string; last_audit: string | null; score: number | null; compliant: boolean | null; issue: string }

export async function shelfWatch(): Promise<ShelfRow[]> {
  return query<ShelfRow>(
    `with last as (select distinct on (customer_id) customer_id, audit_date, score, compliant from ord_display_audit order by customer_id, audit_date desc)
     select c.id, c.name, to_char(l.audit_date, 'YYYY-MM-DD') as last_audit, l.score, l.compliant,
            case when l.customer_id is null then 'Never audited'
                 when l.audit_date < current_date - 30 then 'Audit older than 30 days'
                 when not l.compliant then 'Not compliant'
                 else 'Score below 70' end as issue
       from ord_customer c left join last l on l.customer_id = c.id
      where c.type = 'retailer' and c.status = 'active'
        and (l.customer_id is null or l.audit_date < current_date - 30 or not l.compliant or l.score < 70)
      order by l.score nulls first, c.name`);
}
