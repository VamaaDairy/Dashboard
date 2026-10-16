/** fp_product_image and fp_firm_image, queued by the products / customers steps; each needs an uploader (employee). */
import { adminStaff, upsert } from "../lib/sql";
import type { Step } from "../types";

export const loadImages: Step = async (ctx) => {
  const { product, firm } = ctx.images;
  if (!product.length && !firm.length) return;
  const owner = await adminStaff(ctx);
  if (!owner) throw new Error("Images need an employee to belong to - import EMPLOYEE_MASTER first.");
  const filed = (rows: typeof product) => rows.map((r) => ({ ...r, staff_uid: owner }));
  ctx.summary.push(`product images ${await upsert(ctx, "fp_product_image", filed(product))}`);
  ctx.summary.push(`customer images ${await upsert(ctx, "fp_firm_image", filed(firm))}`);
};
