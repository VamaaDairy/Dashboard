"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { query, tx } from "@/lib/db";
import { UNITS } from "./data";

type Result = { ok: boolean; error?: string };
const NO: Result = { ok: false, error: "You do not have permission to change this." };

async function me() {
  const u = await userFromToken((await cookies()).get("session")?.value);
  return u && atLeast(levelFor(u, "store"), "edit") ? u : null;
}
const done = (): Result => { revalidatePath("/store", "layout"); return { ok: true }; };
const clean = (s: string) => s.trim().replace(/\s+/g, " ");
const isUnique = (e: unknown) => (e as { code?: string })?.code === "23505";

export async function addCategoryAction(name: string): Promise<Result> {
  if (!(await me())) return NO;
  name = clean(name);
  if (name.length < 2) return { ok: false, error: "Enter a category name." };
  try { await query(`insert into store_category (name) values ($1)`, [name]); }
  catch (e) { if (isUnique(e)) return { ok: false, error: "That category already exists." }; throw e; }
  return done();
}

export async function addSubcategoryAction(categoryId: number, name: string): Promise<Result> {
  if (!(await me())) return NO;
  name = clean(name);
  if (!categoryId) return { ok: false, error: "Choose the category first." };
  if (name.length < 2) return { ok: false, error: "Enter a subcategory name." };
  try { await query(`insert into store_subcategory (category_id, name) values ($1, $2)`, [categoryId, name]); }
  catch (e) { if (isUnique(e)) return { ok: false, error: "That subcategory already exists in this category." }; throw e; }
  return done();
}

export async function renameAction(kind: "category" | "subcategory", id: number, name: string): Promise<Result> {
  if (!(await me())) return NO;
  name = clean(name);
  if (name.length < 2) return { ok: false, error: "Enter a name." };
  try { await query(`update ${kind === "category" ? "store_category" : "store_subcategory"} set name = $2 where id = $1`, [id, name]); }
  catch (e) { if (isUnique(e)) return { ok: false, error: "That name is already used." }; throw e; }
  return done();
}

export async function deleteGroupAction(kind: "category" | "subcategory", id: number): Promise<Result> {
  if (!(await me())) return NO;
  const used = kind === "category"
    ? await query(`select 1 from store_item where category_id = $1 limit 1`, [id])
    : await query(`select 1 from store_item where subcategory_id = $1 limit 1`, [id]);
  if (used.length) return { ok: false, error: "Items are filed under this - move or remove them first." };
  await query(`delete from ${kind === "category" ? "store_category" : "store_subcategory"} where id = $1`, [id]);
  return done();
}

export async function addItemAction(i: { name: string; categoryId: number; subcategoryId: number | null; unit: string; minStock: number; notes: string }): Promise<Result> {
  if (!(await me())) return NO;
  const name = clean(i.name);
  if (name.length < 2) return { ok: false, error: "Enter the item name." };
  if (!i.categoryId) return { ok: false, error: "Choose a category." };
  if (!(UNITS as readonly string[]).includes(i.unit)) return { ok: false, error: "Choose a unit." };
  if (!Number.isFinite(i.minStock) || i.minStock < 0) return { ok: false, error: "Minimum stock cannot be negative." };
  if (i.subcategoryId) {
    const ok = await query(`select 1 from store_subcategory where id = $1 and category_id = $2`, [i.subcategoryId, i.categoryId]);
    if (!ok.length) return { ok: false, error: "That subcategory is not in the chosen category." };
  }
  try {
    await query(`insert into store_item (name, category_id, subcategory_id, unit, min_stock, notes) values ($1, $2, $3, $4, $5, $6)`,
      [name, i.categoryId, i.subcategoryId || null, i.unit, i.minStock, clean(i.notes) || null]);
  } catch (e) { if (isUnique(e)) return { ok: false, error: "An item with this name already exists." }; throw e; }
  return done();
}

export async function setItemAction(id: number, patch: { active?: boolean; minStock?: number }): Promise<Result> {
  if (!(await me())) return NO;
  if (patch.minStock !== undefined) {
    if (!Number.isFinite(patch.minStock) || patch.minStock < 0) return { ok: false, error: "Enter a valid quantity." };
    await query(`update store_item set min_stock = $2 where id = $1`, [id, patch.minStock]);
  }
  if (patch.active !== undefined) await query(`update store_item set active = $2 where id = $1`, [id, patch.active]);
  return done();
}

const stockOf = (c: import("pg").PoolClient, id: number) =>
  c.query<{ s: number }>(`select coalesce(sum(case direction when 'in' then qty else -qty end), 0)::float as s from store_movement where item_id = $1`, [id])
    .then((r) => r.rows[0].s);

export async function addMovementAction(m: {
  direction: "in" | "out"; itemId: number; day: string; qty: number; rate: number | null; party: string; refNo: string; notes: string;
}): Promise<Result> {
  const u = await me();
  if (!u) return NO;
  if (m.direction !== "in" && m.direction !== "out") return { ok: false, error: "Unknown entry type." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(m.day)) return { ok: false, error: "Enter the date." };
  if (!Number.isFinite(m.qty) || m.qty <= 0) return { ok: false, error: "Enter a quantity above zero." };
  if (m.rate != null && (!Number.isFinite(m.rate) || m.rate < 0)) return { ok: false, error: "The rate cannot be negative." };
  try {
    await tx(async (c) => {
      const item = await c.query<{ active: boolean; name: string; unit: string }>(`select active, name, unit from store_item where id = $1 for update`, [m.itemId]);
      if (!item.rows.length) throw new Error("Choose an item.");
      if (!item.rows[0].active) throw new Error("This item is inactive. Activate it first.");
      if (m.direction === "out") {
        const have = await stockOf(c, m.itemId);
        if (m.qty > have) throw new Error(`Only ${have} ${item.rows[0].unit} of ${item.rows[0].name} is in stock.`);
      }
      await c.query(
        `insert into store_movement (item_id, day, direction, qty, rate, party, ref_no, notes, created_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [m.itemId, m.day, m.direction, m.qty, m.direction === "in" ? m.rate : null, clean(m.party) || null, clean(m.refNo) || null, clean(m.notes) || null, u.name || u.email],
      );
    });
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Could not save." }; }
  return done();
}

/** Removing a wrong entry. An "in" cannot go if what was issued afterwards would then exceed what is left. */
export async function deleteMovementAction(id: number): Promise<Result> {
  if (!(await me())) return NO;
  try {
    await tx(async (c) => {
      const r = await c.query<{ item_id: number; direction: string; qty: number }>(`select item_id, direction, qty::float from store_movement where id = $1`, [id]);
      if (!r.rows.length) return;
      const { item_id, direction, qty } = r.rows[0];
      await c.query(`select 1 from store_item where id = $1 for update`, [item_id]);
      if (direction === "in" && (await stockOf(c, item_id)) - qty < 0) throw new Error("Part of this has already been issued, so it cannot be removed.");
      await c.query(`delete from store_movement where id = $1`, [id]);
    });
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Could not remove." }; }
  return done();
}
