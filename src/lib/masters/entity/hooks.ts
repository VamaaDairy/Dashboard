import "server-only";
import type { PoolClient } from "pg";
import { FormError } from "./errors";
import type { PhotoChanges, Values } from "./validate";

/** Per-screen rules that don't fit a plain field list. Keyed by the screen's slug. */
export interface HookContext {
  client: PoolClient;
  isNew: boolean;
  id: string | null;
  /** the row as it was before this save (null when adding) */
  before: Record<string, unknown> | null;
}

interface Hooks {
  /** may throw FormError; returns extra columns to write alongside the form's fields */
  prepare?: (ctx: HookContext, values: Values) => Promise<Record<string, unknown> | void>;
  /** runs after the row is written, in the same transaction */
  after?: (ctx: HookContext & { id: string }, values: Values) => Promise<void>;
}

/** The 10-digit mobile number inside whatever was typed ("+91 98765 43210" -> "9876543210"). */
const mobileOf = (v: unknown) => String(v ?? "").replace(/\D/g, "").slice(-10);

async function scalar<T>(client: PoolClient, sql: string, args: unknown[] = []): Promise<T | undefined> {
  const r = await client.query(sql, args);
  return r.rows[0] ? (Object.values(r.rows[0])[0] as T) : undefined;
}

export async function companyFirmId(client: PoolClient) {
  return scalar<string>(
    client,
    `select f.uid from fp_firm f join fp_channel c on c.uid = f.channel_uid where c.channel_code = 'CMP' order by f.created_at limit 1`,
  );
}

export async function adminStaffId(client: PoolClient) {
  return (
    (await scalar<string>(client, `select uid from fp_staff where lower(email) = 'admin@vamaadairy.com' limit 1`)) ??
    (await scalar<string>(client, `select uid from fp_staff order by active desc, created_at limit 1`))
  );
}

const HOOKS: Record<string, Hooks> = {
  // customers: remember the parent's code, belong to the company, keep the parent-link table in step
  distribution: {
    async prepare(ctx, v) {
      const parent = (v.parent_firm_uid as string | null) ?? null;
      if (parent && parent === ctx.id) throw new FormError("A customer cannot be served by itself", "parent_firm_uid");
      const extra: Record<string, unknown> = {
        parents: parent ? (await scalar<string>(ctx.client, `select firm_code from fp_firm where uid = $1`, [parent])) ?? "" : "",
      };
      if (ctx.isNew) extra.company_uid = (await companyFirmId(ctx.client)) ?? null;

      // a distributor with an app login signs in with this number, so it has to stay a usable, unshared mobile number
      if (!ctx.isNew && ctx.id && mobileOf(v.phone) !== mobileOf(ctx.before?.phone)) {
        const login = await scalar<number>(ctx.client, `select id from dist_login where firm_uid = $1`, [ctx.id]);
        if (login !== undefined) {
          const m = mobileOf(v.phone);
          if (!/^[6-9]\d{9}$/.test(m)) throw new FormError("This customer signs in to the app with this number - enter a valid 10-digit mobile number", "phone");
          if (await scalar<number>(ctx.client, `select id from dist_login where phone = $1 and id <> $2`, [m, login]))
            throw new FormError("Another app login already uses this mobile number", "phone");
        }
      }
      return extra;
    },
    async after(ctx, v) {
      if (!ctx.isNew && mobileOf(v.phone) !== mobileOf(ctx.before?.phone)) {
        // keep the app sign-in number the same as the master's
        await ctx.client.query(`update dist_login set phone = $2 where firm_uid = $1`, [ctx.id, mobileOf(v.phone)]);
      }
      const parent = (v.parent_firm_uid as string | null) ?? null;
      if (!ctx.isNew && (ctx.before?.parent_firm_uid ?? null) === parent) return;
      await ctx.client.query(`delete from fp_firm_mapping where firm_uid = $1`, [ctx.id]);
      if (parent) {
        await ctx.client.query(
          `insert into fp_firm_mapping (firm_uid, parent_firm_uid, start_date, active) values ($1, $2, to_char(now() at time zone 'Asia/Kolkata', 'YYYY-MM-DD'), 1)`,
          [ctx.id, parent],
        );
      }
    },
  },

  // employees: belong to the company, keep the manager's name / e-mail text columns in step
  staffs: {
    async prepare(ctx, v) {
      const extra: Record<string, unknown> = {};
      if (ctx.isNew) {
        const company = await companyFirmId(ctx.client);
        if (!company) throw new FormError("There is no company customer yet - import the customers first.");
        extra.firm_uid = company;
      }
      const manager = (v.reporting_manager_uid as string | null) ?? null;
      if (manager && manager === ctx.id) throw new FormError("An employee cannot report to themselves", "reporting_manager_uid");
      const m = manager
        ? (await ctx.client.query(`select trim(first_name || ' ' || coalesce(last_name, '')) as name, email from fp_staff where uid = $1`, [manager])).rows[0]
        : null;
      extra.managers = m?.name ?? null;
      extra.reporting = m?.email ?? null;

      // a sales officer with an app login signs in with this number, so it has to stay a usable, unshared mobile number
      if (!ctx.isNew && ctx.id && mobileOf(v.phone) !== mobileOf(ctx.before?.phone)) {
        const login = await scalar<number>(ctx.client, `select id from dist_login where staff_uid = $1`, [ctx.id]);
        if (login !== undefined) {
          const n = mobileOf(v.phone);
          if (!/^[6-9]\d{9}$/.test(n)) throw new FormError("This employee signs in to the app with this number - enter a valid 10-digit mobile number", "phone");
          if (await scalar<number>(ctx.client, `select id from dist_login where phone = $1 and id <> $2`, [n, login]))
            throw new FormError("Another app login already uses this mobile number", "phone");
        }
      }
      return extra;
    },
    async after(ctx, v) {
      if (!ctx.isNew && mobileOf(v.phone) !== mobileOf(ctx.before?.phone)) {
        await ctx.client.query(`update dist_login set phone = $2 where staff_uid = $1`, [ctx.id, mobileOf(v.phone)]);
      }
    },
  },

  // products: model number / name mirror the SKU, new categories join the category lists
  fpproducts: {
    async prepare(ctx, v) {
      const extra: Record<string, unknown> = { model_name: v.sku_name };
      if (ctx.isNew) extra.model_number = v.sku_code;
      return extra;
    },
    async after(ctx, v) {
      await ctx.client.query(`insert into fp_category (category) select $1::text where not exists (select 1 from fp_category where category = $1::text)`, [v.category]);
      await ctx.client.query(`insert into fp_sub_category (sub_category) select $1::text where not exists (select 1 from fp_sub_category where sub_category = $1::text)`, [v.sub_category]);

      // photos: removed ones go, new ones are kept in the database after the existing ones
      const ph = v.photos as PhotoChanges | undefined;
      if (ph?.remove.length) await ctx.client.query(`delete from fp_product_image where product_uid = $1 and uid = any($2::uuid[])`, [ctx.id, ph.remove]);
      if (ph?.add.length) {
        const owner = await adminStaffId(ctx.client);
        if (!owner) throw new FormError("There are no employees yet to own a photo - import the employees first.", "photos");
        let next = (await scalar<number>(ctx.client, `select coalesce(max(imagesno), 0) + 1 from fp_product_image where product_uid = $1`, [ctx.id])) ?? 1;
        for (const file of ph.add) {
          const id = crypto.randomUUID();
          await ctx.client.query(
            `insert into fp_product_image (uid, image_url, data, mime, imagesno, product_uid, staff_uid) values ($1, $2, $3, $4, $5, $6, $7)`,
            [id, `/api/shop/product-image/${id}`, Buffer.from(await file.arrayBuffer()), file.type, next++, ctx.id, owner],
          );
        }
      }
    },
  },

  // channel prices keep the SKU text next to the product link
  fpchannelrates: {
    async prepare(ctx, v) {
      const sku = await scalar<string>(ctx.client, `select sku_code from fp_product where uid = $1`, [v.product_uid]);
      return { sku_code: sku ?? null };
    },
  },

  // slab prices: pick a slab or name a new one
  priceSlabs: {
    async prepare(ctx, v) {
      const chosen = (v.slab_uid as string | null) ?? null;
      const name = typeof v.new_slab === "string" ? v.new_slab.trim() : "";
      if (chosen && name) throw new FormError("Pick an existing slab or type a new name, not both", "new_slab");
      if (!chosen && !name) throw new FormError("Pick a slab or type a new slab name", "slab_uid");
      if (chosen) return {};
      const owner = await adminStaffId(ctx.client);
      if (!owner) throw new FormError("There are no employees yet to own a new slab - import the employees first.");
      const existing = await scalar<string>(ctx.client, `select uid from fp_slab where name = $1`, [name]);
      if (existing) return { slab_uid: existing };
      const created = await scalar<string>(
        ctx.client,
        `insert into fp_slab (name, active, created_staff_uid, updated_staff_uid) values ($1, 1, $2, $2) returning uid`,
        [name, owner],
      );
      return { slab_uid: created };
    },
  },
};

export const hooksFor = (slug: string): Hooks => HOOKS[slug] ?? {};
