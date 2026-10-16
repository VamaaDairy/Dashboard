/**
 * Demo data for the field-sales portal tables (fp_*): a company, channels, staff,
 * customers, products, beats, a month of visits / orders / invoices / payments.
 * Skips if fp_fp_company already has a row.
 *
 *   npm run db:seed:fp
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

interface Col { field: string; col: string; sql: string; required: boolean }
interface Tbl { table: string; pk: string; columns: Col[] }
const MODEL: Record<string, Tbl> = JSON.parse(readFileSync("src/lib/fp/spec/model.json", "utf8"));

const db = new Client({ connectionString: process.env.DATABASE_URL ?? "postgres://localhost:5432/costing_erp" });
const SKIP = new Set(["createdAt", "updatedAt"]);

/** Inserts one row; required columns not given get a type default. Unknown field names are a bug and throw. */
async function ins(entity: string, v: Record<string, unknown>): Promise<string> {
  const t = MODEL[entity];
  if (!t) throw new Error(`no entity ${entity}`);
  const cols: string[] = [], vals: unknown[] = [], casts: string[] = [];
  for (const k of Object.keys(v)) if (v[k] !== undefined && !t.columns.some((c) => c.field === k)) throw new Error(`${entity}.${k} does not exist`);
  for (const c of t.columns) {
    if (SKIP.has(c.field)) continue;
    let val = v[c.field];
    if (val === undefined) {
      if (c.field === "uid" || !c.required) continue;
      if (c.sql === "text") val = "NA";
      else if (c.sql === "integer" || c.sql === "bigint" || c.sql === "double precision") val = 0;
      else if (c.sql === "timestamptz") val = new Date();
      else if (c.sql === "boolean") val = false;
      else throw new Error(`${entity}.${c.field} is required`);
    }
    cols.push(`"${c.col}"`);
    vals.push(c.sql === "jsonb" && val !== null ? JSON.stringify(val) : val);
    casts.push(c.sql === "jsonb" ? `$${vals.length}::jsonb` : `$${vals.length}`);
  }
  const sql = cols.length ? `insert into "${t.table}" (${cols.join(",")}) values (${casts.join(",")}) returning "${t.pk}"::text as id` : `insert into "${t.table}" default values returning "${t.pk}"::text as id`;
  return (await db.query(sql, vals)).rows[0].id as string;
}

const day = (back: number, h = 10, m = 0) => { const d = new Date(); d.setDate(d.getDate() - back); d.setHours(h, m, 0, 0); return d; };
const pick = <T,>(a: T[], i: number) => a[((i % a.length) + a.length) % a.length];

async function main() {
  await db.connect();
  try {
    if ((await db.query(`select 1 from fp_fp_company limit 1`)).rowCount) { console.log("fp tables already have data - nothing seeded"); return; }
    await db.query("begin");

    // ---- masters
    await ins("country", { name: "India", countryCode: "IN" });
    const states = [["West", "Maharashtra", "MH", "27"], ["West", "Gujarat", "GJ", "24"]];
    for (const [region, state, code, g] of states) await ins("state", { region, state, code, gstinCode: g, active: 1, countryName: "India" });
    for (const t of ["Pune", "Mumbai", "Nashik"]) await ins("team", { team: t, active: 1 });

    const company = await ins("fpCompany", {
      name: "Vamaa Dairy", customerCode: "VAMAA", database: "vamaa", region: "West", countryName: "India", state: "Maharashtra",
      address: "Plant Road, Pune", countryCode: 91, isoCountryCode: "IN", phone: "9800000000", email: "info@vamaadairy.com",
      superAdmin: 0, active: 1, expiryDate: day(-365), availableBalance: 5000, footprintsType: "FPDMS", currency: "INR",
    } as never);

    const chan = async (channel: string, code: string, level: number, parent?: string) =>
      ins("channel", { channel, channelCode: code, autoAccept: 1, level, parentChannelUid: parent ?? null, salesType: "Both", appAccess: 1, portalAccess: 1, retail: level === 3 ? 1 : 0 } as never);
    const chCompany = await chan("Company", "CMP", 0);
    const chDist = await chan("Distributor", "DST", 1, chCompany);
    const chRet = await chan("Retailer", "RTL", 3, chDist);

    const designations: Record<string, string> = {};
    for (const [name, code, dept, full] of [["Admin", "ADM", "Management", 1], ["Area Sales Manager", "ASM", "Sales", 0], ["Sales Officer", "SO", "Sales", 0], ["Delivery Executive", "DEL", "Logistics", 0], ["Promoter", "PRM", "Sales", 0]] as const)
      designations[code] = await ins("designation", { designation: name, designationCode: code, department: dept, fullAccess: full, active: 1, portalAccess: 1, appAccess: 1, level: code === "ADM" ? 0 : code === "ASM" ? 1 : 2 } as never);

    // ---- firms
    const firmCommon = { countryCode: 91, active: 1, parents: "[]", salesReportMapping: "NA", state: undefined };
    const hq = await ins("firm", { ...firmCommon, name: "Vamaa Dairy Pvt Ltd", firmCode: "HQ001", channelUid: chCompany, city: "Pune", stateState: "Maharashtra", address: "Plant Road, Pune", phone: "9800000000", gstin: "27AAAAA0000A1Z5", latitude: 18.5204, longitude: 73.8567, creditLimit: 0 } as never);
    await db.query(`update fp_firm set company_uid = $1 where uid = $1`, [hq]);
    const dists: string[] = [];
    for (const [i, n] of ["Shree Traders", "Om Distributors", "Sai Agencies"].entries())
      dists.push(await ins("firm", { ...firmCommon, name: n, firmCode: `D00${i + 1}`, channelUid: chDist, companyUid: hq, masterFirmUid: hq, city: pick(["Pune", "Nashik", "Mumbai"], i), stateState: "Maharashtra", phone: `970000000${i}`, gstin: `27BBBBB000${i}B1Z5`, creditLimit: 500000, latitude: 18.5 + i * 0.05, longitude: 73.8 + i * 0.04, address: `Market Yard ${i + 1}`, teamTeam: pick(["Pune", "Mumbai", "Nashik"], i) } as never));

    // ---- staff
    const staffDefs: Array<[string, string, string, string]> = [
      ["Prashanjit", "Admin", "ADM", "E001"], ["Ramesh", "Patil", "ASM", "E002"],
      ["Suresh", "Kale", "SO", "E003"], ["Anita", "More", "SO", "E004"], ["Vijay", "Shinde", "SO", "E005"], ["Nilesh", "Gaikwad", "DEL", "E006"],
    ];
    const staff: string[] = [];
    for (const [i, [first, last, des, code]] of staffDefs.entries())
      staff.push(await ins("staff", {
        firstName: first, lastName: last, countryCode: 91, phone: `98000000${10 + i}`, employeeCode: code, email: `${first.toLowerCase()}@vamaadairy.com`, designationUid: designations[des], firmUid: hq,
        active: 1, stateState: "Maharashtra", teamTeam: pick(["Pune", "Mumbai", "Nashik"], i), dateOfJoining: day(600 - i * 40), city: "Pune", gender: i === 3 ? "Female" : "Male",
        reportingManagerUid: i >= 2 && i <= 4 ? undefined : undefined,
      } as never));
    for (const i of [2, 3, 4]) await db.query(`update fp_staff set reporting_manager_uid = $1 where uid = $2`, [staff[1], staff[i]]);
    const sos = [staff[2], staff[3], staff[4]];

    // ---- retailers
    const retailers: string[] = [];
    const rn = ["Patil Dairy", "Sai Kirana", "Fresh Mart", "Gokul Stores", "Anand Sweets", "City Bazaar", "Krishna General", "Lakshmi Stores", "Metro Foods", "Balaji Provision", "Ganesh Mart", "Shivam Stores", "Om Sai Dairy", "Janata Kirana", "Royal Bakery"];
    for (const [i, n] of rn.entries())
      retailers.push(await ins("firm", {
        ...firmCommon, name: n, firmCode: `R${String(i + 1).padStart(3, "0")}`, channelUid: chRet, companyUid: hq, masterFirmUid: dists[i % 3], parentFirmUid: dists[i % 3], salesContactUid: sos[i % 3],
        city: pick(["Pune", "Pune", "Nashik", "Mumbai"], i), stateState: "Maharashtra", pincode: String(411001 + i), phone: `96000000${String(i).padStart(2, "0")}`, address: `Shop ${i + 1}, Main Road`,
        latitude: 18.45 + (i % 7) * 0.02, longitude: 73.78 + (i % 9) * 0.02, creditLimit: 20000 + i * 1000, contactPerson: `Owner ${i + 1}`, newCustomer: i > 12 ? 1 : 0, teamTeam: pick(["Pune", "Mumbai", "Nashik"], i),
      } as never));

    // ---- products
    const tax5 = await ins("taxConfiguration", { categoryName: "GST 5%", taxCode: "GST5", applicableTaxes: [{ name: "CGST", rate: 2.5 }, { name: "SGST", rate: 2.5 }], startDate: day(900), endDate: day(-900) } as never);
    const tax12 = await ins("taxConfiguration", { categoryName: "GST 12%", taxCode: "GST12", applicableTaxes: [{ name: "CGST", rate: 6 }, { name: "SGST", rate: 6 }], startDate: day(900), endDate: day(-900) } as never);
    const prodDefs: Array<[string, string, string, number, number, number]> = [
      ["MLK500", "Toned Milk 500 ml", "Milk", 30, 27, 5], ["MLK1L", "Toned Milk 1 L", "Milk", 58, 52, 5], ["CRD400", "Curd 400 g", "Curd", 40, 34, 5],
      ["CRD1K", "Curd 1 kg", "Curd", 85, 74, 5], ["PNR200", "Paneer 200 g", "Paneer", 90, 78, 5], ["GHE500", "Ghee 500 ml", "Ghee", 340, 305, 12],
      ["GHE1L", "Ghee 1 L", "Ghee", 660, 598, 12], ["PED250", "Peda 250 g", "Sweets", 150, 128, 5], ["BTR100", "Butter 100 g", "Butter", 58, 50, 12], ["LSI200", "Lassi 200 ml", "Beverages", 25, 21, 5],
    ];
    const products: string[] = [];
    const cats = new Set<string>();
    for (const [sku, name, cat, mrp, dp, gst] of prodDefs) {
      if (!cats.has(cat)) { cats.add(cat); await ins("category", { category: cat } as never); }
      products.push(await ins("product", {
        modelNumber: sku, brand: "Vamaa", superBrand: "Vamaa", category: cat, subCategory: cat, modelName: name, skuCode: sku, skuName: name, mrp, dp, variant: "Std",
        taxConfigurationUid: gst === 5 ? tax5 : tax12, active: 1, focusProduct: sku === "GHE500" ? 1 : 0, channelPrice: dp, stock: 500, minQuantityToOrder: 1,
      } as never));
    }

    // ---- beats and plans
    const beats: string[] = [];
    for (const [i, n] of ["Camp beat", "Kothrud beat", "Hadapsar beat", "Baner beat"].entries()) {
      beats.push(await ins("beat", { beatName: n, beatCode: `B${i + 1}`, status: 1, frequency: "Weekly", dayOfVisit: pick(["Mon", "Tue", "Wed", "Thu"], i), staffUid: sos[i % 3], city: "Pune", state: "Maharashtra" } as never));
      await ins("staffBeat", { beatUid: beats[i], staffUid: sos[i % 3] } as never);
    }
    const plans: string[] = [];
    for (const [i, r] of retailers.entries())
      plans.push(await ins("beatPlan", { frequency: "Weekly", dayOfVisit: pick(["Mon", "Tue", "Wed", "Thu"], i), weekOfVisit: 1, beatUid: beats[i % 4], firmUid: r, status: 1 } as never));
    for (const [i, r] of retailers.entries()) await db.query(`update fp_firm set beat_uid = $1 where uid = $2`, [beats[i % 4], r]);

    // ---- activities, attendance, visits
    const actOrder = await ins("channelActivity", { activityName: "Order Booking", photo: 0, visitActivity: 1, fromDate: day(400), type: 1, channelUid: chRet, active: 1 } as never);
    const actVisit = await ins("channelActivity", { activityName: "Mark Visit", photo: 1, visitActivity: 1, fromDate: day(400), type: 1, channelUid: chRet, active: 1 } as never);
    const actDisplay = await ins("channelActivity", { activityName: "Display Audit", photo: 1, visitActivity: 0, fromDate: day(400), type: 2, channelUid: chRet, active: 1, displayAudit: 1 } as never);
    let visitNo = 0;
    for (let back = 25; back >= 0; back--) {
      for (const [i, s] of sos.entries()) {
        const leave = back % 9 === 4 && i === 1;
        const att = await ins("staffAttendance", {
          staffUid: s, attendanceDate: day(back, 0), loginTime: day(back, 9, 5 + i), logoutTime: day(back, 18, 10), status: leave ? "Leave" : "Present", distance: 25 + i * 7 + back % 5,
          loginAddress: "Pune", workingTime: leave ? 0 : 540, absent: leave ? 1 : 0,
        } as never);
        if (leave) continue;
        await ins("staffLocation", { staffUid: s, staffAttendanceUid: att, activityType: "LOGIN", activityTime: day(back, 9, 5), latitude: 18.52 + i * 0.01, longitude: 73.85 + i * 0.01, accuracy: 10, speed: 0 } as never);
        for (let v = 0; v < 3; v++) {
          visitNo++;
          const ri = (back * 3 + i * 5 + v) % retailers.length;
          const ordered = visitNo % 3 !== 0;
          await ins("staffChannelActivity", {
            staffUid: s, firmUid: retailers[ri], beatPlanUid: plans[ri], channelActivityUid: ordered ? actOrder : actVisit, staffAttendanceUid: att,
            bpFrequency: "Weekly", bpDayOfVisit: pick(["Mon", "Tue", "Wed", "Thu"], ri), dayOfVisit: pick(["Mon", "Tue", "Wed", "Thu"], ri), scheduledTime: day(back, 10 + v), startTime: day(back, 10 + v, 5), endTime: day(back, 10 + v, 25),
            timeSpent: 20, bookingOrder: ordered ? 1 : 0, status: "Completed", startAddress: "Pune", endAddress: "Pune", startLat: 18.5, startLng: 73.8, deviation: v === 2 ? 1 : 0, markVisit: ordered ? 0 : 1,
          } as never);
        }
      }
    }
    void actDisplay;

    // ---- secondary orders -> invoices -> bills -> payments
    let ordNo = 0;
    const mkOrder = async (kind: "primary" | "secondary", from: string, to: string, by: string | null, back: number, status: string) => {
      ordNo++;
      const n = 2 + (ordNo % 3);
      const lines = Array.from({ length: n }, (_, k) => {
        const pi = (ordNo + k) % products.length;
        const [, , , mrp, dp] = prodDefs[pi];
        const qty = (kind === "primary" ? 60 : 8) + ((ordNo + k) % 5) * 2;
        return { pi, mrp, dp, qty, cost: Math.round(qty * dp * 100) / 100 };
      });
      const total = Math.round(lines.reduce((s, l) => s + l.cost, 0) * 100) / 100;
      const qtySum = lines.reduce((s, l) => s + l.qty, 0);
      const bo = await ins("bookingOrder", {
        orderUid: randomUUID(), orderId: ordNo, orderType: kind === "primary" ? "PRIMARY" : "SECONDARY", bookingTime: day(back, 11), bookingDate: day(back, 0),
        totalItem: n, weekOfMonth: Math.ceil((day(back).getDate()) / 7), totalQuantity: qtySum, totalCost: total, dealerCost: total, status, currentStatus: status,
        fromFirmUid: from, toFirmUid: to, staffUid: by, retail: kind === "secondary" ? 1 : 0, acceptedQuantity: status === "Pending" ? 0 : qtySum, invoiceQuantity: status === "Delivered" ? qtySum : 0,
      } as never);
      for (const l of lines)
        await ins("bookingOrderItem", { bookingOrderUid: bo, productUid: products[l.pi], mrp: l.mrp, sellingPrice: l.dp, dp: l.dp, quantity: l.qty, stock: 100, totalCost: l.cost, acceptedQuantity: status === "Pending" ? 0 : l.qty, unit: "pc" } as never);
      if (status === "Pending" || status === "Cancelled") return;
      const txn = await ins("transaction", {
        voucherTime: day(back, 14).toISOString(), totalItems: n, totalQuantity: qtySum, totalCost: total, status: status === "Delivered" ? "Accepted" : "Invoiced", voucherNumber: `INV-${String(ordNo).padStart(6, "0")}`,
        voucherType: 1, transactionType: kind === "primary" ? 1 : 2, fromFirmUid: from, toFirmUid: to, bookingOrderUid: bo, userUid: by ?? staff[1], transactionTime: day(back, 14),
      } as never);
      for (const l of lines)
        await ins("transactionItem", { transactionUid: txn, productUid: products[l.pi], mrp: l.mrp, sellingPrice: l.dp, dp: l.dp, channelPrice: l.dp, schemePrice: l.dp, quantity: l.qty, totalCost: l.cost, unit: "pc" } as never);
      const bill = await ins("bill", {
        invoiceDate: day(back, 14), invoiceNumber: `INV-${String(ordNo).padStart(6, "0")}`, invoiceCost: total, currentDue: total, openingDue: 0, totalAmountPaid: 0, transactionUid: txn, bookingOrderUid: bo,
        fromFirmUid: from, toFirmUid: to, status: 1, deliveryStatus: status === "Delivered" ? 1 : 0, billType: kind === "primary" ? "PRIMARY" : "SECONDARY", deliveryStaffUid: staff[5],
      } as never);
      if (back > 6 && ordNo % 3 !== 0) {
        const paid = ordNo % 2 ? total : Math.round(total * 0.5);
        await ins("payment", { transactionUid: txn, billUid: bill, paymentDate: day(back - 3, 12), amountPaid: paid, status: 1, collectedStaffUid: by ?? staff[5] } as never);
        await db.query(`update fp_bill set total_amount_paid = $1, current_due = $2 where uid = $3`, [paid, total - paid, bill]);
      }
    };
    for (let back = 28; back >= 0; back--) {
      for (let k = 0; k < 2; k++) {
        const ri = (back * 2 + k) % retailers.length;
        const status = back > 3 ? "Delivered" : pick(["Pending", "Accepted", "Invoiced", "Delivered"], back + k);
        await mkOrder("secondary", dists[ri % 3], retailers[ri], sos[ri % 3], back, status);
      }
      if (back % 6 === 0) for (const d of dists) await mkOrder("primary", hq, d, null, back, back > 3 ? "Delivered" : "Pending");
    }

    // ---- expenses, leave, tasks, tickets, targets, configuration
    const expTypes: string[] = [];
    for (const t of ["Fuel", "Food", "Travel"]) expTypes.push(await ins("expenseType", { type: t, active: 1, photo: 0 } as never));
    for (let back = 0; back < 20; back += 3) for (const [i, s] of sos.entries())
      await ins("expense", { expenseDate: day(back, 0), amount: 250 + i * 80, status: back > 8 ? "Approved" : "Pending", createdType: "Manual", description: "Field expense", expenseTypeUid: expTypes[back % 3], staffUid: s } as never);
    const lt = await ins("leaveType", { type: "Casual Leave", active: 1 } as never);
    void lt;
    await ins("staffLeave", { staffUid: sos[0], requestTime: day(2), fromDate: day(-3), toDate: day(-4), fromPeriod: "Full Day", toPeriod: "Full Day", days: 2, status: "Pending" } as never);
    const taskType = await ins("taskType", { type: "Collection follow-up", active: 1, updatedByUid: staff[1] } as never);
    const task = await ins("task", { taskName: "Collect pending payment - Fresh Mart", description: "Pending invoices over 30 days", fromDate: day(1), toDate: day(-5), active: 1, updatedByUid: staff[1], createdByUid: staff[1], taskTypeUid: taskType, firmUid: retailers[2] } as never);
    await ins("assignedTask", { status: "Pending", startTime: day(1), assignedStaffUid: sos[0], taskUid: task } as never);
    const tt = await ins("ticketType", { name: "Short supply", active: 1, channelUid: chRet, updatedStaffUid: staff[1] } as never);
    await ins("ticket", { createdDate: day(2), name: "Curd 400 g short by 10 cups", description: "Received less than billed", status: "Open", ticketNo: "TKT-00001", createdFrom: "Portal", priority: "High", createdStaffUid: sos[0], customerUid: retailers[0], ticketTypeUid: tt } as never);
    const month = new Date(); const start = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-01`; const end = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-28`;
    for (const r of retailers.slice(0, 8)) await ins("customerTarget", { firmUid: r, valueTarget: 25000, volumeTarget: 400, achievementConsideration: "Invoice", achievedValueTarget: 0, achievedVolumeTarget: 0, status: 1, startDate: start, endDate: end } as never);
    for (const [k, v] of [["order_booking_enabled", "1"], ["eod_cutoff", "20:00"], ["invoice_editing_period", "2"], ["show_stock", "1"]]) await ins("configuration", { configuration: k, value: v } as never);

    await db.query("commit");
    console.log(`Seeded portal demo data: ${retailers.length + dists.length + 1} firms, ${staff.length} staff, ${products.length} products, ${ordNo} orders, ${visitNo} visits`);
  } catch (e) {
    await db.query("rollback");
    throw e;
  } finally {
    await db.end();
  }
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
