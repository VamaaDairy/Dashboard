/**
 * Demo data for the Orders section: masters, products, customers, staff, a
 * few weeks of orders / visits / attendance, stock and tickets. Skips if the
 * Orders tables already hold anything.
 *
 *   npm run db:seed:orders
 */
import "dotenv/config";
import { Client } from "pg";

const pick = <T,>(a: T[], i: number) => a[i % a.length];
const day = (back: number) => new Date(Date.now() - back * 864e5).toISOString().slice(0, 10);

async function main() {
  const db = new Client({ connectionString: process.env.DATABASE_URL ?? "postgres://localhost:5432/costing_erp" });
  await db.connect();
  try {
    if ((await db.query(`select 1 from ord_staff limit 1`)).rowCount || (await db.query(`select 1 from ord_product limit 1`)).rowCount) {
      console.log("Orders tables already have data - nothing seeded");
      return;
    }
    await db.query("begin");
    const id = async (sql: string, p: unknown[] = []) => (await db.query(sql, p)).rows[0].id as string;
    const master = (kind: string, name: string) =>
      id(`insert into ord_master (kind, name) values ($1,$2) returning id`, [kind, name]);

    const cats: Record<string, string> = {};
    for (const n of ["Milk", "Curd", "Paneer", "Ghee", "Sweets"]) cats[n] = await master("category", n);
    const brand = await master("brand", "Vamaa");
    const channels = [await master("channel", "General trade"), await master("channel", "Modern trade"), await master("channel", "Institutional")];
    const desig = { so: await master("designation", "Sales Officer"), asm: await master("designation", "Area Sales Manager") };
    const etypes = [await master("expense_type", "Fuel"), await master("expense_type", "Food"), await master("expense_type", "Travel")];

    const products = [
      ["MLK-500", "Toned Milk 500 ml", "Milk", "pc", 12, 30, 27, 0],
      ["MLK-1L", "Toned Milk 1 L", "Milk", "pc", 12, 58, 52, 0],
      ["CRD-400", "Curd 400 g", "Curd", "pc", 24, 40, 34, 5],
      ["CRD-1K", "Curd 1 kg", "Curd", "pc", 12, 85, 74, 5],
      ["PNR-200", "Paneer 200 g", "Paneer", "pc", 20, 90, 78, 5],
      ["GHE-500", "Ghee 500 ml", "Ghee", "pc", 12, 340, 305, 12],
      ["GHE-1L", "Ghee 1 L", "Ghee", "pc", 6, 660, 598, 12],
      ["SWT-PED", "Peda 250 g", "Sweets", "pc", 24, 150, 128, 5],
    ].map(([sku, name, cat, uom, upc, mrp, rate, gst]) => ({ sku: sku as string, name: name as string, cat: cat as string, uom, upc, mrp, rate: rate as number, gst: gst as number }));
    const pid: string[] = [];
    for (const p of products) {
      pid.push(await id(
        `insert into ord_product (sku, name, category_id, brand_id, uom, units_per_case, mrp, rate, gst_pct, is_focus) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
        [p.sku, p.name, cats[p.cat], brand, p.uom, p.upc, p.mrp, p.rate, p.gst, p.sku === "GHE-500"]));
      await db.query(`insert into ord_stock_move (product_id, qty, reason, note, moved_on) values ($1,$2,'opening','Opening stock',$3)`, [pid[pid.length - 1], 400, day(40)]);
    }
    await db.query(`insert into ord_scheme (name, product_id, min_qty, free_qty, valid_from, valid_to) values ('Buy 24 curd, get 2 free', $1, 24, 2, $2, $3)`, [pid[2], day(30), day(-30)]);

    const asm = await id(`insert into ord_staff (code, name, designation_id, phone, region, joined_on) values ('E001','Ramesh Patil',$1,'9800000001','West',$2) returning id`, [desig.asm, day(900)]);
    const staff = [asm];
    for (const [i, n] of ["Suresh Kale", "Anita More", "Vijay Shinde"].entries()) {
      staff.push(await id(`insert into ord_staff (code, name, designation_id, reporting_to, phone, region, joined_on) values ($1,$2,$3,$4,$5,'West',$6) returning id`,
        [`E00${i + 2}`, n, desig.so, asm, `98000000${i + 2}`, day(400)]));
    }

    const dists: string[] = [];
    for (const [i, n] of ["Shree Traders", "Om Distributors"].entries())
      dists.push(await id(`insert into ord_customer (code, name, type, channel_id, staff_id, city, phone, credit_limit, credit_days) values ($1,$2,'distributor',$3,$4,'Pune',$5,500000,30) returning id`,
        [`D00${i + 1}`, n, channels[0], asm, `97000000${i + 1}`]));
    const beats: string[] = [];
    for (const [i, n] of ["Camp beat", "Kothrud beat", "Hadapsar beat", "Baner beat"].entries())
      beats.push(await id(`insert into ord_beat (name, staff_id, distributor_id, weekday) values ($1,$2,$3,$4) returning id`,
        [n, staff[1 + (i % 3)], dists[i % 2], pick(["Mon", "Tue", "Wed", "Thu"], i)]));
    const retailers: string[] = [];
    const rnames = ["Patil Dairy", "Sai Kirana", "Fresh Mart", "Gokul Stores", "Anand Sweets", "City Bazaar", "Krishna General", "Lakshmi Stores", "Metro Foods", "Balaji Provision"];
    for (const [i, n] of rnames.entries())
      retailers.push(await id(
        `insert into ord_customer (code, name, type, channel_id, parent_id, staff_id, beat_id, city, phone, status) values ($1,$2,'retailer',$3,$4,$5,$6,'Pune',$7,'active') returning id`,
        [`R${String(i + 1).padStart(3, "0")}`, n, pick(channels, i), dists[i % 2], staff[1 + (i % 3)], beats[i % 4], `96000000${String(i).padStart(2, "0")}`]));

    // orders over the last 5 weeks
    let o = 0;
    for (let back = 35; back >= 0; back -= 1) {
      for (const kind of back % 5 === 0 ? ["primary", "secondary"] : ["secondary", "secondary"]) {
        o++;
        const isPrimary = kind === "primary";
        const cust = isPrimary ? dists[o % 2] : retailers[o % retailers.length];
        const sId = staff[1 + (o % 3)];
        const n = 2 + (o % 3);
        let sub = 0, tax = 0;
        const items: Array<[string, number, number, number, number]> = [];
        for (let k = 0; k < n; k++) {
          const p = products[(o + k) % products.length];
          const qty = (isPrimary ? 40 : 6) + ((o + k) % 5) * 2;
          const amount = Math.round(qty * p.rate * 100) / 100;
          sub += amount; tax += amount * p.gst / 100;
          items.push([pid[(o + k) % products.length], qty, p.rate, p.gst, amount]);
        }
        const status = back > 3 ? "delivered" : pick(["created", "approved", "invoiced", "delivered"], o);
        const oid = await id(
          `insert into ord_order (kind, customer_id, staff_id, order_date, status, subtotal, tax, total) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
          [kind, cust, sId, day(back), status, sub.toFixed(2), tax.toFixed(2), (sub + tax).toFixed(2)]);
        for (const [pp, qty, rate, gst, amount] of items) {
          await db.query(`insert into ord_order_item (order_id, product_id, qty, rate, gst_pct, amount) values ($1,$2,$3,$4,$5,$6)`, [oid, pp, qty, rate, gst, amount]);
          if (status === "delivered") await db.query(`insert into ord_stock_move (product_id, qty, reason, ref_type, ref_id, moved_on) values ($1,$2,'sale','order',$3,$4)`, [pp, -qty, oid, day(back)]);
        }
      }
    }
    // a received purchase restocks, so stock isn't negative
    const po = await id(`insert into ord_purchase (supplier, po_date, status, total) values ('Vamaa Dairy Plant',$1,'received',0) returning id`, [day(20)]);
    let ptotal = 0;
    for (const [i, p] of products.entries()) {
      const qty = 600; const amount = qty * p.rate * 0.9; ptotal += amount * (1 + p.gst / 100);
      await db.query(`insert into ord_purchase_item (purchase_id, product_id, qty, rate, gst_pct, amount) values ($1,$2,$3,$4,$5,$6)`, [po, pid[i], qty, p.rate * 0.9, p.gst, amount]);
      await db.query(`insert into ord_stock_move (product_id, qty, reason, ref_type, ref_id, moved_on) values ($1,$2,'purchase','purchase',$3,$4)`, [pid[i], qty, po, day(20)]);
    }
    await db.query(`update ord_purchase set total = $2 where id = $1`, [po, ptotal.toFixed(2)]);
    await db.query(`insert into ord_purchase (supplier, po_date, status, total) values ('Packaging Co.', $1, 'draft', 0)`, [day(1)]);

    // visits, attendance, expenses, tasks, targets, tickets
    for (let back = 0; back < 20; back++) {
      for (const [i, s] of staff.slice(1).entries()) {
        await db.query(`insert into ord_attendance (staff_id, day, status, check_in, check_out) values ($1,$2,$3,'09:05','18:10') on conflict do nothing`,
          [s, day(back), back % 7 === 6 ? "leave" : "present"]);
        for (let v = 0; v < 3; v++) {
          const ordered = (back + i + v) % 3 === 0;
          await db.query(`insert into ord_visit (staff_id, customer_id, visit_date, outcome, order_value) values ($1,$2,$3,$4,$5)`,
            [s, retailers[(back + i * 3 + v) % retailers.length], day(back), ordered ? "order" : pick(["no_order", "follow_up"], v), ordered ? 1500 + v * 400 : 0]);
        }
        if (back % 4 === 0) await db.query(`insert into ord_expense (staff_id, day, type_id, amount, status) values ($1,$2,$3,$4,$5)`,
          [s, day(back), etypes[back % 3], 250 + i * 80, back > 8 ? "approved" : "pending"]);
      }
    }
    await db.query(`insert into ord_task (title, staff_id, due_date, priority) values ('Collect pending payment - Fresh Mart', $1, $2, 'high'), ('Place display at City Bazaar', $3, $2, 'medium')`,
      [staff[1], day(-3), staff[2]]);
    const period = day(0).slice(0, 7);
    for (const s of staff.slice(1)) {
      for (const [m, t] of [["sales", 60000], ["orders", 40], ["visits", 80], ["new_outlets", 5]] as const)
        await db.query(`insert into ord_kpi_target (staff_id, period, metric, target) values ($1,$2,$3,$4)`, [s, period, m, t]);
    }
    await db.query(`insert into ord_ticket (subject, customer_id, staff_id, priority, status, description) values
      ('Short supply of curd 400 g', $1, $3, 'high', 'open', 'Retailer received 10 cups less than billed.'),
      ('Credit note pending', $2, $3, 'medium', 'in_progress', 'Leaked packs returned last week.'),
      ('Invoice copy needed', $2, $3, 'low', 'resolved', 'Sent by WhatsApp.')`, [retailers[0], retailers[3], asm]);

    await db.query("commit");
    console.log(`Seeded Orders demo data: ${products.length} products, ${retailers.length + dists.length} customers, ${staff.length} staff, ${o} orders`);
  } catch (e) {
    await db.query("rollback");
    throw e;
  } finally {
    await db.end();
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
