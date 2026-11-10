import "server-only";
import { one, query } from "@/lib/db";
import { listCustomers, type CustomerRow } from "@/lib/d2c/sales";

/**
 * Customer Master: every customer the business sells to, in three kinds.
 * - Distributors and retailers are the Customer Masters firms (fp_firm) in the DB and RT channels; they order
 *   from the Gaia Distributors app or through sales officers, and may also be a route-orders party.
 * - D2C customers are the Gaia app's shoppers (shop_customer).
 * The same person or shop can turn up in more than one list (or twice in one): `duplicates` finds those by mobile.
 */
export type FirmKind = "distributors" | "retailers";
export type CustomerKind = FirmKind | "d2c";
export const CUSTOMER_KINDS: Array<{ key: CustomerKind; label: string; one: string }> = [
  { key: "distributors", label: "Distributors", one: "Distributor" },
  { key: "retailers", label: "Retailers", one: "Retailer" },
  { key: "d2c", label: "D2C customers", one: "D2C customer" },
];
export const isCustomerKind = (k: string): k is CustomerKind => CUSTOMER_KINDS.some((c) => c.key === k);
const CHANNEL: Record<FirmKind, string> = { distributors: "DB", retailers: "RT" };

/** A mobile number as its last ten digits, so "+91 98765 43210" and "9876543210" match. */
const MOBILE = (expr: string) => `nullif(right(regexp_replace(coalesce(${expr}, ''), '\\D', '', 'g'), 10), '')`;

export interface FirmRow {
  uid: string; name: string; code: string | null; city: string | null; phone: string | null; contactPerson: string | null;
  active: boolean; servedBy: string | null; route: string | null; salesOfficer: string | null; priceList: string | null;
  appLogin: boolean; orders: number; lastOrder: Date | null; value90: number;
}

/** Distributors or retailers, most recently active first. */
export async function listFirms(kind: FirmKind, q = ""): Promise<FirmRow[]> {
  const like = `%${q.trim().toLowerCase()}%`;
  return query<FirmRow>(
    `select f.uid, f.name, f.firm_code as code, f.city, f.phone, f.contact_person as "contactPerson", f.active = 1 as active,
            p.name as "servedBy", b.beat_name as route,
            nullif(trim(so.first_name || ' ' || coalesce(so.last_name, '')), '') as "salesOfficer",
            (select s.name from fp_slab_firm_mapping m join fp_slab s on s.uid = m.slab_uid where m.firm_uid = f.uid order by m.updated_at desc limit 1) as "priceList",
            exists (select 1 from dist_login l where l.firm_uid = f.uid and l.active) as "appLogin",
            coalesce(o.n, 0)::int as orders, o.last as "lastOrder", coalesce(o.v90, 0)::float as value90
       from fp_firm f
       join fp_channel ch on ch.uid = f.channel_uid and upper(ch.channel_code) = $1
       left join fp_firm p on p.uid = f.parent_firm_uid
       left join fp_beat b on b.uid = f.beat_uid
       left join fp_staff so on so.uid = f.sales_contact_uid
       left join lateral (
         select count(*) as n, max(bo.booking_time) as last,
                sum(bo.total_cost) filter (where bo.booking_time > now() - interval '90 days') as v90
           from fp_booking_order bo where bo.from_firm_uid = f.uid) o on true
      where $2 = '%%' or lower(f.name) like $2 or lower(coalesce(f.firm_code, '')) like $2 or coalesce(f.phone, '') like $2
         or lower(coalesce(f.city, '')) like $2 or lower(coalesce(f.contact_person, '')) like $2
      order by (f.active = 1) desc, o.last desc nulls last, f.name
      limit 2000`,
    [CHANNEL[kind], like],
  );
}

export const listD2c = (q = ""): Promise<CustomerRow[]> => listCustomers(q, "newest");

/** How many of each kind, for the tabs. */
export async function customerCounts(): Promise<Record<CustomerKind, number>> {
  const r = await one<{ db: number; rt: number; d2c: number }>(
    `select (select count(*)::int from fp_firm f join fp_channel c on c.uid = f.channel_uid where upper(c.channel_code) = 'DB') as db,
            (select count(*)::int from fp_firm f join fp_channel c on c.uid = f.channel_uid where upper(c.channel_code) = 'RT') as rt,
            (select count(*)::int from shop_customer) as d2c`,
  );
  return { distributors: r?.db ?? 0, retailers: r?.rt ?? 0, d2c: r?.d2c ?? 0 };
}

// ---------------------------------------------------------------- one firm's profile

export interface FirmProfile {
  uid: string; name: string; code: string | null; kind: FirmKind | null; channel: string | null; type: string | null; class: string | null;
  active: boolean; createdAt: Date | null; erpCode: string | null;
  contactPerson: string | null; phone: string | null; landline: string | null; email: string | null;
  address: string | null; area: string | null; city: string | null; district: string | null; state: string | null; pincode: string | null;
  lat: number | null; lng: number | null; gstin: string | null; pan: string | null; licenceNo: string | null; creditLimit: number | null;
  servedBy: { uid: string; name: string } | null; route: string | null;
  salesOfficer: string | null; salesOfficerPhone: string | null;
  priceList: string | null;
  logins: Array<{ kind: string; phone: string; active: boolean }>;
  routeParty: { id: number; name: string; route: string | null; tallyLedger: string | null } | null;
}

export async function firmProfile(uid: string): Promise<FirmProfile | null> {
  if (!/^[0-9a-f-]{36}$/i.test(uid)) return null;
  return one<FirmProfile>(
    `select f.uid, f.name, f.firm_code as code,
            case upper(ch.channel_code) when 'DB' then 'distributors' when 'RT' then 'retailers' end as kind,
            ch.channel, f.firm_type as type, f.firm_class as class, f.active = 1 as active, f.created_at as "createdAt", f.erp_code as "erpCode",
            f.contact_person as "contactPerson", f.phone, f.landline, f.email, f.address, f.place as area, f.city, f.district,
            f.state_state as state, f.pincode, f.latitude as lat, f.longitude as lng, f.gstin, f.pan, f.license_no as "licenceNo",
            f.credit_limit as "creditLimit",
            case when p.uid is null then null else json_build_object('uid', p.uid, 'name', p.name) end as "servedBy",
            b.beat_name as route,
            nullif(trim(so.first_name || ' ' || coalesce(so.last_name, '')), '') as "salesOfficer", so.phone as "salesOfficerPhone",
            (select s.name from fp_slab_firm_mapping m join fp_slab s on s.uid = m.slab_uid where m.firm_uid = f.uid order by m.updated_at desc limit 1) as "priceList",
            coalesce((select json_agg(json_build_object('kind', l.kind, 'phone', l.phone, 'active', l.active) order by l.id)
                        from dist_login l where l.firm_uid = f.uid), '[]') as logins,
            (select json_build_object('id', rp.id, 'name', rp.name, 'route', rr.name, 'tallyLedger', rp.tally_ledger)
               from route_order_party rp left join route_order_route rr on rr.id = rp.route_id where rp.firm_uid = f.uid) as "routeParty"
       from fp_firm f
       left join fp_channel ch on ch.uid = f.channel_uid
       left join fp_firm p on p.uid = f.parent_firm_uid
       left join fp_beat b on b.uid = f.beat_uid
       left join fp_staff so on so.uid = f.sales_contact_uid
      where f.uid = $1`,
    [uid],
  );
}

export interface FirmOrder { uid: string; orderId: number | null; at: Date; items: number; qty: number; total: number; status: string; appKind: string | null }

export const firmOrders = (uid: string) =>
  query<FirmOrder>(
    `select bo.uid, bo.order_id as "orderId", bo.booking_time as at, bo.total_item as items, bo.total_quantity::float as qty,
            bo.total_cost::float as total, coalesce(bo.current_status, bo.status) as status, bo.app_kind as "appKind"
       from fp_booking_order bo where bo.from_firm_uid = $1 order by bo.booking_time desc limit 100`,
    [uid],
  );

/** Retailers a distributor serves (fp_firm.parent_firm_uid). */
export const servedFirms = (uid: string) =>
  query<{ uid: string; name: string; code: string | null; city: string | null; active: boolean }>(
    `select uid, name, firm_code as code, city, active = 1 as active from fp_firm where parent_firm_uid = $1 order by active desc, name`,
    [uid],
  );

// ---------------------------------------------------------------- the same customer more than once

export interface DuplicateGroup {
  mobile: string;
  records: Array<{ kind: CustomerKind; id: string; name: string; detail: string | null; active: boolean }>;
}

/** Mobile numbers that belong to more than one customer record, in any of the three lists. */
export async function duplicates(): Promise<DuplicateGroup[]> {
  const rows = await query<{ mobile: string; kind: CustomerKind; id: string; name: string; detail: string | null; active: boolean }>(
    `with all_customers as (
       select ${MOBILE("f.phone")} as mobile,
              case upper(ch.channel_code) when 'DB' then 'distributors' else 'retailers' end as kind,
              f.uid::text as id, f.name, concat_ws(' · ', f.firm_code, f.city) as detail, f.active = 1 as active
         from fp_firm f join fp_channel ch on ch.uid = f.channel_uid and upper(ch.channel_code) in ('DB', 'RT')
       union all
       select ${MOBILE("c.phone")}, 'd2c', c.id::text, c.name, c.pincode, true from shop_customer c
     )
     select a.* from all_customers a
      where a.mobile is not null and a.mobile in (select mobile from all_customers where mobile is not null group by mobile having count(*) > 1)
      order by a.mobile, a.kind, a.name`,
  );
  const groups = new Map<string, DuplicateGroup>();
  for (const r of rows) {
    const g = groups.get(r.mobile) ?? { mobile: r.mobile, records: [] };
    g.records.push({ kind: r.kind, id: r.id, name: r.name, detail: r.detail, active: r.active });
    groups.set(r.mobile, g);
  }
  return [...groups.values()];
}

/** Where a customer record's profile lives. */
export const profileHref = (kind: CustomerKind, id: string) => (kind === "d2c" ? `/d2c/customers/${id}` : `/customers/firm/${id}`);
