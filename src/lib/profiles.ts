import "server-only";
import { one, query } from "@/lib/db";
import { loadAccessUser } from "@/lib/access-server";
import { RESOURCES, type Level } from "@/lib/access";
import { getTree } from "@/lib/outstandings/tally";

/**
 * Everything around one employee or one customer that the profile pages show beyond the master record: who they
 * sit under and over, every login and account that is them, what they handle and sell, and what changed.
 * The master records themselves come from lib/employees (employeeProfile) and lib/customers (firmProfile).
 */

const FULL_NAME = (a: string) => `nullif(trim(${a}.first_name || ' ' || coalesce(${a}.last_name, '')), '')`;
const MOBILE = (expr: string) => `nullif(right(regexp_replace(coalesce(${expr}, ''), '\\D', '', 'g'), 10), '')`;
const KIND = (code: string) => `case upper(${code}) when 'SS' then 'Super stockist' when 'DB' then 'Distributor' when 'MFS' then 'MFS'
  when 'IT' then 'Institution' when 'PT' then 'Parlour' when 'RT' then 'Retailer' when 'CMP' then 'Company' else coalesce(${code}, 'Other') end`;

export interface Person { uid: string; name: string; designation: string | null; active?: boolean }
export interface Month { month: string; orders: number; value: number }
export interface OrderLine { uid: string; orderId: number | null; at: Date; firm: string | null; firmUid: string | null; kind: string | null; items: number; total: number; status: string }
export interface AuditEntry { at: Date; actor: string | null; action: string; summary: string | null }
export interface OrderStats { orders: number; value: number; value90: number; orders90: number; first: Date | null; last: Date | null }

/** The last 12 months, oldest first, filled in with zeros. */
function months(rows: Month[]): Month[] {
  const by = new Map(rows.map((r) => [r.month, r]));
  const out: Month[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 11; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`;
    out.push(by.get(key) ?? { month: key, orders: 0, value: 0 });
  }
  return out;
}

const MONTHLY = (where: string) => `
  select to_char(date_trunc('month', bo.booking_time at time zone 'Asia/Kolkata'), 'YYYY-MM') as month,
         count(*)::int as orders, coalesce(sum(bo.total_cost), 0)::float as value
    from fp_booking_order bo where ${where} and bo.booking_time >= date_trunc('month', now()) - interval '11 months'
   group by 1`;
const STATS = (where: string) => `
  select count(*)::int as orders, coalesce(sum(bo.total_cost), 0)::float as value,
         coalesce(sum(bo.total_cost) filter (where bo.booking_time > now() - interval '90 days'), 0)::float as value90,
         (count(*) filter (where bo.booking_time > now() - interval '90 days'))::int as orders90,
         min(bo.booking_time) as first, max(bo.booking_time) as last
    from fp_booking_order bo where ${where}`;

const audit = (uid: string) =>
  query<AuditEntry>(
    `select at, actor, action, summary from master_audit where record_id = $1 order by at desc limit 30`,
    [uid],
  );

// ---------------------------------------------------------------- employees

export interface AccessRow { group: string; label: string; level: Level }
export interface EmployeeExtras {
  chain: Person[];
  team: { direct: number; total: number; byDesignation: Array<{ designation: string; n: number }> };
  customers: { total: number; active: number; byKind: Array<{ kind: string; n: number }>; top: Array<{ uid: string; name: string; kind: string; city: string | null; active: boolean; orders: number; value: number }> };
  stats: OrderStats;
  monthly: Month[];
  recent: OrderLine[];
  accounts: {
    employeeApp: { phone: string; active: boolean; device: string | null; lastLogin: Date | null; since: Date | null } | null;
    salesforce: Array<{ phone: string; active: boolean; since: Date | null }>;
    dashboard: { id: string; email: string; name: string; role: string; active: boolean; mobile: string | null; since: Date | null } | null;
  };
  access: { role: string; department: string | null; rows: AccessRow[] } | null;
  days: Array<{ date: string; start: Date | null; end: Date | null }>;
  beats: Array<{ name: string; code: string | null; city: string | null; day: string | null }>;
  history: AuditEntry[];
}

const TEAM = `with recursive team as (
    select uid, 1 as lvl from fp_staff where reporting_manager_uid = $1 and uid <> $1
    union
    select s.uid, t.lvl + 1 from fp_staff s join team t on s.reporting_manager_uid = t.uid where t.lvl < 12 and s.uid <> $1)`;
/** Their own orders as a sales officer, and those of the customers they look after. */
const STAFF_ORDERS = `(bo.staff_uid = $1 or bo.from_firm_uid in (select uid from fp_firm where sales_contact_uid = $1))`;

export async function employeeExtras(uid: string): Promise<EmployeeExtras> {
  const [chain, team, designations, kinds, top, stats, monthly, recent, empApp, sf, dash, days, beats, history] = await Promise.all([
    query<Person & { lvl: number }>(
      `with recursive up as (
         select s.reporting_manager_uid as uid, 1 as lvl from fp_staff s where s.uid = $1 and s.reporting_manager_uid is not null
         union
         select s.reporting_manager_uid, up.lvl + 1 from up join fp_staff s on s.uid = up.uid
          where up.lvl < 12 and s.reporting_manager_uid is not null and s.reporting_manager_uid <> $1)
       select s.uid, coalesce(${FULL_NAME("s")}, 'Unnamed') as name, d.designation, coalesce(s.active, 1) = 1 as active, min(up.lvl) as lvl
         from up join fp_staff s on s.uid = up.uid left join fp_designation d on d.uid = s.designation_uid
        group by s.uid, d.designation order by lvl desc`,
      [uid],
    ),
    one<{ direct: number; total: number }>(
      `${TEAM} select (select count(*) from fp_staff where reporting_manager_uid = $1 and uid <> $1 and coalesce(active, 1) = 1)::int as direct,
              (select count(distinct t.uid) from team t join fp_staff s on s.uid = t.uid where coalesce(s.active, 1) = 1)::int as total`,
      [uid],
    ),
    query<{ designation: string; n: number }>(
      `${TEAM} select coalesce(d.designation, 'No designation') as designation, count(distinct s.uid)::int as n
         from team t join fp_staff s on s.uid = t.uid left join fp_designation d on d.uid = s.designation_uid
        where coalesce(s.active, 1) = 1 group by 1 order by 2 desc limit 8`,
      [uid],
    ),
    query<{ kind: string; n: number; active: number }>(
      `select ${KIND("ch.channel_code")} as kind, count(*)::int as n, (count(*) filter (where f.active = 1))::int as active
         from fp_firm f left join fp_channel ch on ch.uid = f.channel_uid where f.sales_contact_uid = $1 group by 1 order by 2 desc`,
      [uid],
    ),
    query<EmployeeExtras["customers"]["top"][number]>(
      `select f.uid, f.name, ${KIND("ch.channel_code")} as kind, f.city, f.active = 1 as active,
              coalesce(o.n, 0)::int as orders, coalesce(o.v, 0)::float as value
         from fp_firm f left join fp_channel ch on ch.uid = f.channel_uid
         left join lateral (select count(*) as n, sum(total_cost) as v from fp_booking_order where from_firm_uid = f.uid) o on true
        where f.sales_contact_uid = $1
        order by coalesce(o.v, 0) desc, f.active desc, f.name limit 40`,
      [uid],
    ),
    one<OrderStats>(STATS(STAFF_ORDERS), [uid]),
    query<Month>(MONTHLY(STAFF_ORDERS), [uid]),
    query<OrderLine>(
      `select bo.uid, bo.order_id as "orderId", bo.booking_time as at, f.name as firm, f.uid as "firmUid", ${KIND("ch.channel_code")} as kind,
              bo.total_item as items, coalesce(bo.total_cost, 0)::float as total, coalesce(bo.current_status, bo.status, '—') as status
         from fp_booking_order bo left join fp_firm f on f.uid = bo.from_firm_uid left join fp_channel ch on ch.uid = f.channel_uid
        where ${STAFF_ORDERS} order by bo.booking_time desc limit 15`,
      [uid],
    ),
    one<NonNullable<EmployeeExtras["accounts"]["employeeApp"]>>(
      `select phone, active, device, last_login as "lastLogin", created_at as since from emp_login where staff_uid = $1 limit 1`,
      [uid],
    ),
    query<EmployeeExtras["accounts"]["salesforce"][number]>(
      `select phone, active, created_at as since from dist_login where staff_uid = $1 and kind = 'salesman' order by id`,
      [uid],
    ),
    one<NonNullable<EmployeeExtras["accounts"]["dashboard"]>>(
      `select u.id, u.email, u.name, u.role, u.is_active as active, u.mobile, u.created_at as since
         from emp_master m join app_user u on u.id = m.app_user_id where m.staff_uid = $1`,
      [uid],
    ),
    query<{ date: string; start: Date | null; end: Date | null }>(
      `select to_char(d.work_date, 'YYYY-MM-DD') as date, min(d.started_at) as start, max(d.ended_at) as "end" from (
         select work_date, started_at, ended_at from sf_day where staff_uid = $1
         union all
         select work_date, null, null from emp_attendance where staff_uid = $1) d
        group by d.work_date order by d.work_date desc limit 14`,
      [uid],
    ),
    query<EmployeeExtras["beats"][number]>(
      `select beat_name as name, beat_code as code, city, day_of_visit as day from fp_beat where staff_uid = $1 order by beat_name limit 30`,
      [uid],
    ),
    audit(uid),
  ]);

  let access: EmployeeExtras["access"] = null;
  if (dash) {
    const u = await loadAccessUser(dash.id);
    if (u) {
      const owner = u.role === "owner";
      access = {
        role: u.role,
        department: u.department?.name ?? null,
        rows: RESOURCES.map((r) => ({ group: r.group, label: r.label, level: owner ? "edit" : (u.access[r.key] ?? "none") }))
          .filter((r) => r.level !== "none") as AccessRow[],
      };
    }
  }

  return {
    chain,
    team: { direct: team?.direct ?? 0, total: team?.total ?? 0, byDesignation: designations },
    customers: { total: kinds.reduce((s, k) => s + k.n, 0), active: kinds.reduce((s, k) => s + k.active, 0), byKind: kinds, top },
    stats: stats ?? { orders: 0, value: 0, value90: 0, orders90: 0, first: null, last: null },
    monthly: months(monthly),
    recent,
    accounts: { employeeApp: empApp, salesforce: sf, dashboard: dash },
    access,
    days,
    beats,
    history,
  };
}

// ---------------------------------------------------------------- customers

export interface FirmExtras {
  salesOfficerUid: string | null;
  chain: Array<{ uid: string; name: string; kind: string }>;
  network: { direct: number; total: number; byKind: Array<{ kind: string; n: number }> };
  stats: OrderStats;
  received: OrderStats;
  monthly: Month[];
  products: Array<{ name: string; sku: string | null; qty: number; value: number; orders: number }>;
  ledger: { balance: number; entries: Array<{ date: string; kind: string; ref: string | null; debit: number; credit: number; notes: string | null }> };
  invoices: number;
  tally: { ledger: string; balance: number | null; error: string | null } | null;
  sameMobile: {
    firms: Array<{ uid: string; name: string; kind: string; code: string | null }>;
    d2c: Array<{ id: number; name: string; since: Date | null; orders: number }>;
    whatsapp: Array<{ name: string | null; waId: string; last: Date | null }>;
  };
  creditNotes: Array<{ id: string; no: string | null; date: string | null; status: string | null }>;
  complaints: Array<{ id: string; no: string | null; date: string | null; stage: string | null; product: string | null; value: number | null }>;
  history: AuditEntry[];
}

const DOWN = `with recursive down as (
    select uid, 1 as lvl from fp_firm where parent_firm_uid = $1 and uid <> $1
    union
    select f.uid, d.lvl + 1 from fp_firm f join down d on f.parent_firm_uid = d.uid where d.lvl < 8 and f.uid <> $1)`;

/** A Tally balance, without holding the page up when Tally is slow or off. */
async function tallyBalance(ledger: string): Promise<{ balance: number | null; error: string | null }> {
  try {
    const tree = await Promise.race([getTree(), new Promise<never>((_, no) => setTimeout(() => no(new Error("Tally did not answer in time")), 4000))]);
    const l = tree.ledgers.find((x) => x.name.trim().toLowerCase() === ledger.trim().toLowerCase());
    return l ? { balance: l.balance, error: null } : { balance: null, error: "No such ledger under Sundry Debtors" };
  } catch (e) {
    return { balance: null, error: e instanceof Error ? e.message : "Tally is not reachable" };
  }
}

export async function firmExtras(uid: string, f: { name: string; phone: string | null; tallyLedger: string | null }): Promise<FirmExtras> {
  const mobile = (f.phone ?? "").replace(/\D/g, "").slice(-10) || null;
  const [so, chain, net, kinds, stats, received, monthly, products, ledger, entries, invoices, firms, d2c, wa, cns, complaints, history, tally] = await Promise.all([
    one<{ uid: string | null }>(`select sales_contact_uid as uid from fp_firm where uid = $1`, [uid]),
    query<{ uid: string; name: string; kind: string; lvl: number }>(
      `with recursive up as (
         select parent_firm_uid as uid, 1 as lvl from fp_firm where uid = $1 and parent_firm_uid is not null
         union
         select f.parent_firm_uid, up.lvl + 1 from up join fp_firm f on f.uid = up.uid
          where up.lvl < 8 and f.parent_firm_uid is not null and f.parent_firm_uid <> $1)
       select f.uid, f.name, ${KIND("ch.channel_code")} as kind, min(up.lvl) as lvl
         from up join fp_firm f on f.uid = up.uid left join fp_channel ch on ch.uid = f.channel_uid
        group by f.uid, ch.channel_code order by lvl desc`,
      [uid],
    ),
    one<{ direct: number; total: number }>(
      `${DOWN} select (select count(*) from fp_firm where parent_firm_uid = $1 and uid <> $1)::int as direct, (select count(distinct uid) from down)::int as total`,
      [uid],
    ),
    query<{ kind: string; n: number }>(
      `${DOWN} select ${KIND("ch.channel_code")} as kind, count(distinct f.uid)::int as n
         from down d join fp_firm f on f.uid = d.uid left join fp_channel ch on ch.uid = f.channel_uid group by 1 order by 2 desc`,
      [uid],
    ),
    one<OrderStats>(STATS("bo.from_firm_uid = $1"), [uid]),
    one<OrderStats>(STATS("bo.to_firm_uid = $1"), [uid]),
    query<Month>(MONTHLY("bo.from_firm_uid = $1"), [uid]),
    query<FirmExtras["products"][number]>(
      `select coalesce(p.sku_name, 'Unknown product') as name, p.sku_code as sku, coalesce(sum(i.quantity), 0)::float as qty,
              coalesce(sum(i.total_cost), 0)::float as value, count(distinct bo.uid)::int as orders
         from fp_booking_order bo join fp_booking_order_item i on i.booking_order_uid = bo.uid
         left join fp_product p on p.uid = i.product_uid
        where bo.from_firm_uid = $1 group by 1, 2 order by 4 desc limit 8`,
      [uid],
    ),
    one<{ balance: number }>(`select coalesce(sum(debit - credit), 0)::float as balance from dist_ledger where firm_uid = $1`, [uid]),
    query<FirmExtras["ledger"]["entries"][number]>(
      `select to_char(entry_date, 'YYYY-MM-DD') as date, kind, ref, coalesce(debit, 0)::float as debit, coalesce(credit, 0)::float as credit, notes
         from dist_ledger where firm_uid = $1 order by entry_date desc, id desc limit 10`,
      [uid],
    ),
    one<{ n: number }>(`select count(*)::int as n from dist_invoice i join fp_booking_order bo on bo.uid = i.booking_order_uid where bo.from_firm_uid = $1`, [uid]),
    mobile
      ? query<FirmExtras["sameMobile"]["firms"][number]>(
          `select f.uid, f.name, ${KIND("ch.channel_code")} as kind, f.firm_code as code
             from fp_firm f left join fp_channel ch on ch.uid = f.channel_uid
            where ${MOBILE("f.phone")} = $2 and f.uid <> $1 order by f.name limit 10`,
          [uid, mobile],
        )
      : Promise.resolve([]),
    mobile
      ? query<FirmExtras["sameMobile"]["d2c"][number]>(
          `select c.id, c.name, c.created_at as since, (select count(*) from shop_order o where o.customer_id = c.id)::int as orders
             from shop_customer c where ${MOBILE("c.phone")} = $1 limit 5`,
          [mobile],
        )
      : Promise.resolve([]),
    mobile
      ? query<FirmExtras["sameMobile"]["whatsapp"][number]>(
          `select name, wa_id as "waId", last_message_at as last from wa_contact where ${MOBILE("wa_id")} = $1 limit 5`,
          [mobile],
        )
      : Promise.resolve([]),
    query<FirmExtras["creditNotes"][number]>(
      `select id, challan_no as no, to_char(challan_date, 'YYYY-MM-DD') as date, status from credit_note
        where lower(trim(customer_name)) = lower(trim($1)) or ($2::text is not null and ${MOBILE("contact_no")} = $2)
        order by challan_date desc nulls last limit 10`,
      [f.name, mobile],
    ),
    query<FirmExtras["complaints"][number]>(
      `select id, complaint_no as no, to_char(complaint_date, 'YYYY-MM-DD') as date, stage, product_name as product, claim_value::float as value
         from cn_complaint
        where lower(trim(customer_name)) = lower(trim($1)) or ($2::text is not null and ${MOBILE("contact_no")} = $2)
        order by complaint_date desc nulls last limit 10`,
      [f.name, mobile],
    ),
    audit(uid),
    f.tallyLedger ? tallyBalance(f.tallyLedger) : Promise.resolve(null),
  ]);

  const empty: OrderStats = { orders: 0, value: 0, value90: 0, orders90: 0, first: null, last: null };
  return {
    salesOfficerUid: so?.uid ?? null,
    chain: chain.map(({ uid: u, name, kind }) => ({ uid: u, name, kind })),
    network: { direct: net?.direct ?? 0, total: net?.total ?? 0, byKind: kinds },
    stats: stats ?? empty,
    received: received ?? empty,
    monthly: months(monthly),
    products,
    ledger: { balance: ledger?.balance ?? 0, entries },
    invoices: invoices?.n ?? 0,
    tally: f.tallyLedger && tally ? { ledger: f.tallyLedger, ...tally } : null,
    sameMobile: { firms, d2c, whatsapp: wa },
    creditNotes: cns,
    complaints,
    history,
  };
}

// ---------------------------------------------------------------- more detail, per tab

export interface TimelineItem { at: Date; kind: string; text: string; actor: string | null; href: string | null }

export interface FirmMore {
  prices: Array<{ sku: string; name: string; mrp: number | null; price: number; source: "list" | "channel" | "product"; list: string | null }>;
  pattern: {
    avgGapDays: number | null; perMonth: number | null; topWeekday: string | null; daysSinceLast: number | null;
    statuses: Array<{ label: string; n: number }>; via: Array<{ label: string; n: number }>;
  };
  timeline: TimelineItem[];
}

const VIA = `case bo.app_kind when 'distributor' then 'Distributor app' when 'retailer' then 'Retailer app' when 'salesman' then 'Sales officer' else 'Portal' end`;

export async function firmMore(uid: string, name: string): Promise<FirmMore> {
  const { firmPrices } = await import("@/lib/distributor");
  const [prices, gap, statuses, via, timeline] = await Promise.all([
    firmPrices(uid).catch(() => []),
    one<{ avg: number | null; months: number | null; weekday: string | null; since: number | null }>(
      `with o as (select booking_time as t from fp_booking_order where from_firm_uid = $1)
       select (select avg(extract(epoch from d) / 86400)::float from (select t - lag(t) over (order by t) as d from o) g where d is not null) as avg,
              (select case when count(*) = 0 then null else count(*)::float / greatest(1, ceil(extract(epoch from now() - min(t)) / (86400 * 30.4))) end from o) as months,
              (select trim(to_char(t at time zone 'Asia/Kolkata', 'Day')) from o group by 1 order by count(*) desc limit 1) as weekday,
              (select floor(extract(epoch from now() - max(t)) / 86400)::int from o) as since`,
      [uid],
    ),
    query<{ label: string; n: number }>(
      `select initcap(coalesce(current_status, status, 'unknown')) as label, count(*)::int as n from fp_booking_order where from_firm_uid = $1 group by 1 order by 2 desc`,
      [uid],
    ),
    query<{ label: string; n: number }>(`select ${VIA} as label, count(*)::int as n from fp_booking_order bo where bo.from_firm_uid = $1 group by 1 order by 2 desc`, [uid]),
    query<TimelineItem>(
      `select * from (
         select bo.booking_time as at, 'order' as kind,
                'Order ' || coalesce(bo.order_id::text, left(bo.uid::text, 8)) || ' placed · ₹' || to_char(round(coalesce(bo.total_cost, 0)), 'FM99,99,99,999') as text,
                ${VIA} as actor, '/app-orders/distributors/' || bo.uid as href
           from fp_booking_order bo where bo.from_firm_uid = $1
         union all
         select e.at, 'order', 'Order ' || coalesce(bo.order_id::text, left(bo.uid::text, 8)) || ' ' || e.action || coalesce(' · ' || nullif(e.note, ''), ''), e.actor,
                '/app-orders/distributors/' || bo.uid
           from dist_order_event e join fp_booking_order bo on bo.uid = e.order_uid where bo.from_firm_uid = $1 and e.action <> 'placed'
         union all
         select a.at, 'record', coalesce(a.summary, initcap(a.action) || ' record'), a.actor, null from master_audit a where a.record_id = $1::text
         union all
         select a.at, 'self', coalesce(a.summary, initcap(a.action)), a.actor, null from master_audit a where a.actor like $2 and a.record_id <> $1::text
         union all
         select c.created_at, 'complaint', 'Complaint ' || coalesce(c.complaint_no, '') || coalesce(' · ' || c.product_name, ''), c.registered_by, '/cn/' || c.id
           from cn_complaint c where lower(trim(c.customer_name)) = lower(trim($3))
         union all
         select c.created_at, 'credit note', 'Credit note ' || coalesce(c.challan_no, '') || coalesce(' · ' || c.status, ''), c.created_by, '/credit-note/' || c.id
           from credit_note c where lower(trim(c.customer_name)) = lower(trim($3))
       ) t order by at desc limit 80`,
      [uid, `${name} (%`, name],
    ),
  ]);
  const skus = prices.map((p) => p.sku);
  const products = skus.length
    ? await query<{ sku: string; name: string; mrp: number | null }>(`select sku_code as sku, sku_name as name, mrp::float as mrp from fp_product where sku_code = any($1::text[])`, [skus])
    : [];
  const bySku = new Map(products.map((p) => [p.sku, p]));
  return {
    prices: prices
      .map((p) => ({ ...p, name: bySku.get(p.sku)?.name ?? p.sku, mrp: bySku.get(p.sku)?.mrp ?? null }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    pattern: {
      avgGapDays: gap?.avg ?? null, perMonth: gap?.months ?? null, topWeekday: gap?.weekday ?? null, daysSinceLast: gap?.since ?? null,
      statuses, via,
    },
    timeline,
  };
}

export interface EmployeeMore {
  peers: Person[];
  departmentSize: number;
  taken: { orders: number; value: number };
  leaves: { daysThisYear: number; pending: number; rows: Array<{ type: string; from: string; to: string; days: number; status: string; reason: string | null }> };
  claims: { pending: number; approved: number; paid: number; rows: Array<{ category: string | null; amount: number; spentOn: string | null; status: string }> };
  payslips: Array<{ month: string; net: number; published: boolean }>;
  requests: Array<{ subject: string | null; kind: string | null; status: string; at: Date }>;
  dashboardActions: { total: number; rows: AuditEntry[] };
}

export async function employeeMore(uid: string, dashboardName: string | null): Promise<EmployeeMore> {
  const [peers, dept, taken, leaveSum, leaves, claimSum, claims, slips, reqs, actCount, acts] = await Promise.all([
    query<Person>(
      `select r.uid, coalesce(${FULL_NAME("r")}, 'Unnamed') as name, d.designation from fp_staff s
         join fp_staff r on r.reporting_manager_uid = s.reporting_manager_uid and r.uid <> s.uid and coalesce(r.active, 1) = 1
         left join fp_designation d on d.uid = r.designation_uid
        where s.uid = $1 and s.reporting_manager_uid is not null order by 2 limit 12`,
      [uid],
    ),
    one<{ n: number }>(
      `select count(*)::int as n from emp_master m join emp_master me on me.department_id = m.department_id
         join fp_staff s on s.uid = m.staff_uid and coalesce(s.active, 1) = 1 where me.staff_uid = $1`,
      [uid],
    ),
    one<{ orders: number; value: number }>(`select count(*)::int as orders, coalesce(sum(total_cost), 0)::float as value from fp_booking_order where staff_uid = $1`, [uid]),
    one<{ days: number; pending: number }>(
      `select coalesce(sum(days) filter (where status = 'approved' and from_date >= date_trunc('year', current_date)), 0)::float as days,
              (count(*) filter (where status = 'pending'))::int as pending from emp_leave where staff_uid = $1`,
      [uid],
    ),
    query<EmployeeMore["leaves"]["rows"][number]>(
      `select coalesce(t.name, 'Leave') as type, to_char(l.from_date, 'YYYY-MM-DD') as "from", to_char(l.to_date, 'YYYY-MM-DD') as "to",
              coalesce(l.days, 0)::float as days, l.status, l.reason
         from emp_leave l left join emp_leave_type t on t.id = l.type_id where l.staff_uid = $1 order by l.from_date desc limit 8`,
      [uid],
    ),
    one<{ pending: number; approved: number; paid: number }>(
      `select coalesce(sum(amount) filter (where status = 'pending'), 0)::float as pending,
              coalesce(sum(coalesce(approved_amount, amount)) filter (where status = 'approved'), 0)::float as approved,
              coalesce(sum(coalesce(approved_amount, amount)) filter (where status = 'paid' or paid_at is not null), 0)::float as paid
         from emp_claim where staff_uid = $1`,
      [uid],
    ),
    query<EmployeeMore["claims"]["rows"][number]>(
      `select category, amount::float, to_char(spent_on, 'YYYY-MM-DD') as "spentOn", status from emp_claim where staff_uid = $1 order by created_at desc limit 8`,
      [uid],
    ),
    query<EmployeeMore["payslips"][number]>(
      `select month::text as month, coalesce(net, 0)::float as net, coalesce(published, false) as published from emp_payslip where staff_uid = $1 order by month desc limit 6`,
      [uid],
    ),
    query<EmployeeMore["requests"][number]>(
      `select subject, kind, status, created_at as at from emp_request where staff_uid = $1 order by created_at desc limit 6`,
      [uid],
    ),
    dashboardName ? one<{ n: number }>(`select count(*)::int as n from master_audit where actor = $1`, [dashboardName]) : Promise.resolve(null),
    dashboardName ? query<AuditEntry>(`select at, actor, action, summary from master_audit where actor = $1 order by at desc limit 25`, [dashboardName]) : Promise.resolve([]),
  ]);
  return {
    peers,
    departmentSize: dept?.n ?? 0,
    taken: taken ?? { orders: 0, value: 0 },
    leaves: { daysThisYear: leaveSum?.days ?? 0, pending: leaveSum?.pending ?? 0, rows: leaves },
    claims: { ...(claimSum ?? { pending: 0, approved: 0, paid: 0 }), rows: claims },
    payslips: slips,
    requests: reqs,
    dashboardActions: { total: actCount?.n ?? 0, rows: acts },
  };
}
