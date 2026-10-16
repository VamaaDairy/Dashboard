/** Demo rows for the pricing, HR and engagement tabs. Skips if holidays already exist. npm run db:seed:orders-extra */
import "dotenv/config";
import { Client } from "pg";

async function main() {
  const db = new Client({ connectionString: process.env.DATABASE_URL ?? "postgres://localhost:5432/costing_erp" });
  await db.connect();
  try {
    if ((await db.query(`select 1 from ord_holiday limit 1`)).rowCount) { console.log("already seeded"); return; }
    await db.query("begin");
    const period = new Date().toISOString().slice(0, 7);
    await db.query(`insert into ord_holiday (day, name) values ('2026-10-20','Diwali'),('2026-11-05','Bhau Beej'),('2026-12-25','Christmas')`);
    await db.query(`insert into ord_channel_rate (channel_id, product_id, margin_pct, rate)
      select m.id, p.id, 8, round(p.rate * 0.97, 2) from ord_master m cross join ord_product p where m.kind = 'channel' and m.name = 'Modern trade'`);
    await db.query(`insert into ord_slab (product_id, min_qty, max_qty, rate) select id, 0, 49, rate from ord_product where sku = 'MLK-500'
      union all select id, 50, null, rate - 1 from ord_product where sku = 'MLK-500'`);
    await db.query(`insert into ord_planogram (name, channel_id, product_id, shelf, facings)
      select 'Chiller standard', null, id, 'Eye level', 3 from ord_product where is_focus`);
    await db.query(`insert into ord_green_target (staff_id, product_id, period, target)
      select s.id, p.id, $1, 20 from ord_staff s cross join ord_product p where p.is_focus and s.code <> 'E001'`, [period]);
    await db.query(`insert into ord_unmap_request (customer_id, staff_id, reason) select c.id, c.staff_id, 'Outlet closed permanently' from ord_customer c where c.type = 'retailer' order by c.code limit 1`);
    await db.query(`insert into ord_customer (code, name, type, status, city) values ('R900','New Bhagyashree Stores','retailer','pending','Pune')`);
    await db.query(`insert into ord_customer_target (customer_id, period, target) select id, $1, 25000 from ord_customer where type = 'retailer' limit 5`, [period]);
    await db.query(`insert into ord_leave (staff_id, from_date, to_date, type, reason) select id, current_date + 3, current_date + 4, 'casual', 'Family function' from ord_staff where code = 'E002'`);
    await db.query(`insert into ord_hiring (candidate, designation_id, region, phone, stage, expected_join)
      select 'Nitin Jadhav', id, 'Pune East', '9811111111', 'interview', current_date + 15 from ord_master where kind = 'designation' and name = 'Sales Officer'`);
    await db.query(`insert into ord_promoter (name, phone, customer_id, staff_id, joined_on) select 'Kavita Rane', '9822222222', c.id, c.staff_id, current_date - 60 from ord_customer c where c.name = 'Fresh Mart'`);
    await db.query(`insert into ord_display_audit (customer_id, staff_id, score, compliant, notes) select c.id, c.staff_id, 82, true, 'Chiller full, branding ok' from ord_customer c where c.name in ('Fresh Mart','Metro Foods')`);
    await db.query(`insert into ord_location_log (staff_id, lat, lng, note) select id, 18.5204, 73.8567, 'Start of day' from ord_staff where code in ('E002','E003')`);
    await db.query(`insert into ord_broadcast (title, body, status) values ('Diwali scheme live', 'Extra 2% on all ghee orders till 31 Oct.', 'sent'), ('Month-end collection drive', 'Please clear pending payments.', 'draft')`);
    await db.query(`insert into ord_catalogue (title, product_id, url) select name || ' brochure', id, 'https://example.com/' || lower(sku) from ord_product where is_focus`);
    const quiz = (await db.query(`insert into ord_quiz (title, topic, pass_pct) values ('Product knowledge - ghee','Products',60) returning id`)).rows[0].id;
    await db.query(`insert into ord_quiz_question (quiz_id, question, option_a, option_b, option_c, answer) values
      ($1,'Ghee is made from?','Milk fat','Vegetable oil','Cream powder','a'),
      ($1,'Ideal storage for ghee?','Freezer','Cool dry place','Open sunlight','b')`, [quiz]);
    await db.query(`insert into ord_quiz_result (quiz_id, staff_id, score_pct) select $1, id, 80 from ord_staff where code in ('E002','E003')`, [quiz]);
    await db.query(`update ord_customer set lat = 18.45 + (hashtext(code) % 100)/1000.0, lng = 73.78 + (hashtext(code || 'x') % 120)/1000.0 where lat is null`);
    await db.query(`update ord_location_log set lat = 18.52, lng = 73.85`);
    await db.query("commit");
    console.log("seeded extra Orders demo rows");
  } catch (e) { await db.query("rollback"); throw e; } finally { await db.end(); }
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
