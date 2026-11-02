import { query } from "@/lib/db";

export const UNITS = ["pcs", "kg", "g", "litre", "ml", "box", "bag", "packet", "roll", "set", "metre", "bottle", "can"] as const;

export interface Category { id: number; name: string; items: number }
export interface Subcategory { id: number; category_id: number; name: string; items: number }

export interface StockRow {
  id: number; name: string; unit: string; min_stock: number; active: boolean; notes: string | null;
  category_id: number; category: string; subcategory_id: number | null; subcategory: string | null;
  qty_in: number; qty_out: number; stock: number; avg_rate: number | null; value: number; last_day: string | null;
}

export interface MovementRow {
  id: number; item_id: number; item: string; unit: string; category: string; subcategory: string | null;
  day: string; direction: "in" | "out"; qty: number; rate: number | null; party: string | null;
  ref_no: string | null; notes: string | null; created_by: string | null;
}

export const getCategories = () =>
  query<Category>(`select c.id, c.name, (select count(*)::int from store_item i where i.category_id = c.id) as items
                   from store_category c order by lower(c.name)`);

export const getSubcategories = () =>
  query<Subcategory>(`select s.id, s.category_id, s.name, (select count(*)::int from store_item i where i.subcategory_id = s.id) as items
                      from store_subcategory s order by lower(s.name)`);

/** Every item with what has come in, gone out and what is left. */
export const getStock = () =>
  query<StockRow>(`
    select i.id, i.name, i.unit, i.min_stock::float, i.active, i.notes,
           c.id as category_id, c.name as category, s.id as subcategory_id, s.name as subcategory,
           coalesce(m.qty_in, 0)::float as qty_in, coalesce(m.qty_out, 0)::float as qty_out,
           (coalesce(m.qty_in, 0) - coalesce(m.qty_out, 0))::float as stock,
           case when coalesce(m.bought_qty, 0) > 0 then (m.bought_value / m.bought_qty)::float end as avg_rate,
           ((coalesce(m.qty_in, 0) - coalesce(m.qty_out, 0)) * coalesce(m.bought_value / nullif(m.bought_qty, 0), 0))::float as value,
           to_char(m.last_day, 'YYYY-MM-DD') as last_day
      from store_item i
      join store_category c on c.id = i.category_id
      left join store_subcategory s on s.id = i.subcategory_id
      left join (
        select item_id,
               sum(qty) filter (where direction = 'in') as qty_in,
               sum(qty) filter (where direction = 'out') as qty_out,
               sum(qty) filter (where direction = 'in' and rate is not null) as bought_qty,
               sum(qty * rate) filter (where direction = 'in' and rate is not null) as bought_value,
               max(day) as last_day
          from store_movement group by item_id
      ) m on m.item_id = i.id
     order by lower(c.name), lower(coalesce(s.name, '')), lower(i.name)`);

export interface MovementFilter { item?: number; direction?: "in" | "out"; from?: string; to?: string; category?: number; limit?: number }

export function getMovements(f: MovementFilter = {}) {
  const where: string[] = [];
  const p: unknown[] = [];
  const add = (sql: string, v: unknown) => { p.push(v); where.push(sql.replace("?", `$${p.length}`)); };
  if (f.item) add("m.item_id = ?", f.item);
  if (f.direction) add("m.direction = ?", f.direction);
  if (f.from) add("m.day >= ?", f.from);
  if (f.to) add("m.day <= ?", f.to);
  if (f.category) add("i.category_id = ?", f.category);
  p.push(f.limit ?? 300);
  return query<MovementRow>(`
    select m.id, m.item_id, i.name as item, i.unit, c.name as category, s.name as subcategory,
           to_char(m.day, 'YYYY-MM-DD') as day, m.direction, m.qty::float, m.rate::float,
           m.party, m.ref_no, m.notes, m.created_by
      from store_movement m
      join store_item i on i.id = m.item_id
      join store_category c on c.id = i.category_id
      left join store_subcategory s on s.id = i.subcategory_id
      ${where.length ? "where " + where.join(" and ") : ""}
     order by m.day desc, m.id desc limit $${p.length}`, p);
}

export const inr = (n: number | null | undefined) =>
  n == null ? "—" : "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
export const qtyFmt = (n: number) => Number(n).toLocaleString("en-IN", { maximumFractionDigits: 3 });
