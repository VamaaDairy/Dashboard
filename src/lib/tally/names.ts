import "server-only";
import { query, tx } from "@/lib/db";
import { DEBTORS_ROOT, TallyError, attrName, chunks, collection, post, tag } from "@/lib/outstandings/tally";

/**
 * Tally's own names - ledgers, stock items and units - read from Tally (export requests only; nothing is written to
 * Tally) and kept in tally_name, for the masters to pick from and for the check before a Tally file is made.
 *
 * After a read, blanks and near-misses in the masters are filled where Tally leaves no doubt:
 *   - a name that differs from a Tally name only in case, spaces or punctuation takes Tally's exact spelling
 *   - a customer with no Tally name whose GSTIN is on exactly one Sundry Debtors ledger takes that ledger
 *   - a customer or product with no Tally name whose name is exactly one Tally name (ignoring case and spaces) takes it
 */

export const keyOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const KEY = (sql: string) => `regexp_replace(lower(${sql}), '[^a-z0-9]', '', 'g')`;

export interface TallyNameCounts { ledgers: number; debtors: number; items: number; units: number; readAt: string | null }

export interface ReadResult extends TallyNameCounts {
  /** what the read put into the masters, for the page to list */
  filled: Array<{ what: "customer" | "product"; name: string; from: string | null; to: string; why: string }>;
}

export async function tallyNameCounts(): Promise<TallyNameCounts> {
  const r = await query<{ ledgers: number; debtors: number; items: number; units: number; read_at: string | null }>(
    `select count(*) filter (where kind = 'ledger')::int as ledgers, count(*) filter (where kind = 'ledger' and debtor)::int as debtors,
            count(*) filter (where kind = 'item')::int as items, count(*) filter (where kind = 'unit')::int as units,
            to_char(max(read_at) at time zone 'Asia/Kolkata', 'DD Mon YYYY, HH24:MI') as read_at
       from tally_name`,
  );
  const x = r[0];
  return { ledgers: x?.ledgers ?? 0, debtors: x?.debtors ?? 0, items: x?.items ?? 0, units: x?.units ?? 0, readAt: x?.read_at ?? null };
}

/** The ledger's GSTIN: older Tally keeps it on the ledger, TallyPrime in its GST registration details. */
const gstinOf = (c: string) => (tag(c, "PARTYGSTIN") || tag(c, "GSTIN")).toUpperCase().replace(/\s/g, "") || null;

/** Reads every ledger, stock item and unit from Tally, keeps them, and fills the masters where Tally leaves no doubt. */
export async function readTallyNames(who: string | null): Promise<ReadResult> {
  // one at a time: Tally's gateway serves a single request at once
  const gBody = await post(collection("TNGroups", "Group", ["Name", "Parent"]));
  const lBody = await post(collection("TNLedgers", "Ledger", ["Name", "Parent", "PartyGSTIN", "LedGSTRegDetails"]));
  const iBody = await post(collection("TNItems", "StockItem", ["Name", "BaseUnits"]));
  const uBody = await post(collection("TNUnits", "Unit", ["Name"]));
  const ledgers = chunks(lBody, "LEDGER").map((c) => ({ name: attrName(c), parent: tag(c, "PARENT"), gstin: gstinOf(c) })).filter((l) => l.name);
  if (!ledgers.length) throw new TallyError("Tally sent no ledgers. Is the company open in Tally on the server?");

  // the groups under Sundry Debtors, to tell customers' ledgers from the rest
  const groups = chunks(gBody, "GROUP").map((c) => ({ name: attrName(c), parent: tag(c, "PARENT") }));
  const under = new Set([DEBTORS_ROOT]);
  for (let grew = true; grew;) {
    grew = false;
    for (const g of groups) if (!under.has(g.name) && under.has(g.parent)) { under.add(g.name); grew = true; }
  }
  const items = chunks(iBody, "STOCKITEM").map((c) => ({ name: attrName(c), unit: tag(c, "BASEUNITS") })).filter((i) => i.name);
  const units = chunks(uBody, "UNIT").map((c) => attrName(c)).filter(Boolean);

  const filled: ReadResult["filled"] = [];
  await tx(async (c) => {
    await c.query(`delete from tally_name`);
    const put = async (rows: Array<[string, string, string | null, string | null, boolean]>) => {
      for (let i = 0; i < rows.length; i += 500) {
        const part = rows.slice(i, i + 500);
        await c.query(
          `insert into tally_name (kind, name, parent, gstin, debtor)
           select * from unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::boolean[]) on conflict (kind, name) do nothing`,
          [part.map((r) => r[0]), part.map((r) => r[1]), part.map((r) => r[2]), part.map((r) => r[3]), part.map((r) => r[4])],
        );
      }
    };
    await put(ledgers.map((l) => ["ledger", l.name, l.parent || null, l.gstin, under.has(l.parent)]));
    await put(items.map((i) => ["item", i.name, i.unit || null, null, false]));
    await put(units.map((u) => ["unit", u, null, null, false]));

    // spelling: the same name but for case, spaces or punctuation -> Tally's exact spelling (only when one Tally name fits)
    const spell = async (table: "fp_firm" | "fp_product", kind: "ledger" | "item", label: string, what: "customer" | "product") => {
      const r = await c.query<{ name: string; was: string; now: string }>(
        `with one as (
           select ${KEY("name")} as k, min(name) as name from tally_name where kind = $1 group by 1 having count(*) = 1
         ), hit as (
           select t.uid, t.${label} as name, t.tally_name as was, one.name as now from ${table} t join one on one.k = ${KEY("t.tally_name")}
            where coalesce(trim(t.tally_name), '') <> '' and t.tally_name <> one.name
              and not exists (select 1 from tally_name n where n.kind = $1 and n.name = t.tally_name)
         )
         update ${table} t set tally_name = hit.now from hit where t.uid = hit.uid
         returning hit.name, hit.was, hit.now`,
        [kind],
      );
      for (const x of r.rows) filled.push({ what, name: x.name, from: x.was, to: x.now, why: "Tally's exact spelling" });
    };
    await spell("fp_firm", "ledger", "name", "customer");
    await spell("fp_product", "item", "sku_name", "product");

    // customers with no Tally name: by GSTIN (one Sundry Debtors ledger), then by the same name (one ledger)
    const byGst = await c.query<{ name: string; now: string }>(
      `with one as (
         select upper(gstin) as g, min(name) as name from tally_name where kind = 'ledger' and debtor and gstin is not null group by 1 having count(*) = 1
       )
       update fp_firm f set tally_name = one.name from one
        where f.active = 1 and coalesce(trim(f.tally_name), '') = '' and length(f.gstin) = 15 and upper(f.gstin) = one.g
       returning f.name, one.name as now`,
    );
    for (const x of byGst.rows) filled.push({ what: "customer", name: x.name, from: null, to: x.now, why: "same GSTIN" });
    const byName = await c.query<{ name: string; now: string }>(
      `with one as (
         select ${KEY("name")} as k, min(name) as name from tally_name where kind = 'ledger' and debtor group by 1 having count(*) = 1
       )
       update fp_firm f set tally_name = one.name from one
        where f.active = 1 and coalesce(trim(f.tally_name), '') = '' and ${KEY("f.name")} = one.k
       returning f.name, one.name as now`,
    );
    for (const x of byName.rows) filled.push({ what: "customer", name: x.name, from: null, to: x.now, why: "same name" });
    const products = await c.query<{ name: string; now: string }>(
      `with one as (
         select ${KEY("name")} as k, min(name) as name from tally_name where kind = 'item' group by 1 having count(*) = 1
       )
       update fp_product p set tally_name = one.name from one
        where coalesce(trim(p.tally_name), '') = '' and ${KEY("p.sku_name")} = one.k
       returning p.sku_name as name, one.name as now`,
    );
    for (const x of products.rows) filled.push({ what: "product", name: x.name, from: null, to: x.now, why: "same name" });

    // keep the route sheet's copies the same
    await c.query(`update route_order_party rp set tally_ledger = f.tally_name from fp_firm f
                    where rp.firm_uid = f.uid and coalesce(trim(f.tally_name), '') <> '' and rp.tally_ledger is distinct from f.tally_name`);
    await c.query(`update route_order_product rp set tally_item = p.tally_name from fp_product p
                    where rp.sku_no::text = regexp_replace(p.sku_code, '\\D', '', 'g') and coalesce(trim(p.tally_name), '') <> ''
                      and rp.tally_item is distinct from p.tally_name`);
  });

  const counts = await tallyNameCounts();
  await query(`insert into tally_name_read (read_by, ledgers, items, filled) values ($1, $2, $3, $4)`, [who, counts.ledgers, counts.items, JSON.stringify(filled)]);
  return { ...counts, filled };
}

/** The last read from Tally: when, by whom, and what it filled in the masters. */
export async function lastTallyRead() {
  return (await query<{ read_at: string; read_by: string | null; filled: ReadResult["filled"] }>(
    `select to_char(read_at at time zone 'Asia/Kolkata', 'DD Mon YYYY, HH24:MI') as read_at, read_by, filled from tally_name_read order by id desc limit 1`,
  ))[0] ?? null;
}

// ------------------------------------------------------------------ the check

export interface NameIssue { name: string; tallyName: string | null; problem: string; hint: string | null }
export interface TallyCheck {
  counts: TallyNameCounts;
  customers: NameIssue[];
  products: NameIssue[];
  /** sales ledgers, units and the tax / round-off ledgers the Tally file uses */
  others: NameIssue[];
  /** customers who order but have no Tally name */
  noName: Array<{ name: string; channel: string | null; code: string | null }>;
}

/** A Tally name close to [name]: the same letters, or one containing the other. */
const NEAR = (kind: string, sql: string) => `(select n.name from tally_name n where n.kind = '${kind}'
    and (${KEY("n.name")} = ${KEY(sql)} or ${KEY("n.name")} like '%' || ${KEY(sql)} || '%' or ${KEY(sql)} like '%' || ${KEY("n.name")} || '%')
    order by abs(length(n.name) - length(${sql})) limit 1)`;

/** Every Tally name the Dashboard uses that Tally does not have, against the names last read from Tally. */
export async function tallyCheck(): Promise<TallyCheck> {
  const counts = await tallyNameCounts();
  if (!counts.ledgers) return { counts, customers: [], products: [], others: [], noName: [] };
  const [customers, products, others, noName] = await Promise.all([
    query<NameIssue>(
      `select f.name, f.tally_name as "tallyName", 'Not a ledger in Tally' as problem, ${NEAR("ledger", "f.tally_name")} as hint
         from fp_firm f
        where f.active = 1 and coalesce(trim(f.tally_name), '') <> ''
          and not exists (select 1 from tally_name n where n.kind = 'ledger' and n.name = f.tally_name)
        order by f.name`,
    ),
    query<NameIssue>(
      `select p.sku_name as name, p.tally_name as "tallyName", 'Not a stock item in Tally' as problem, ${NEAR("item", "p.tally_name")} as hint
         from fp_product p
        where p.active = 1 and coalesce(trim(p.tally_name), '') <> ''
          and not exists (select 1 from tally_name n where n.kind = 'item' and n.name = p.tally_name)
        order by p.sku_name`,
    ),
    query<NameIssue>(
      `with used as (
         select distinct tally_ledger as v, 'ledger' as kind, 'Sales ledger' as what from route_order_product where active and coalesce(tally_ledger, '') <> ''
         union select distinct tally_unit, 'unit', 'Unit' from route_order_product where active and coalesce(tally_unit, '') <> ''
         union select x, 'ledger', 'Tax / round-off ledger' from unnest(array['Output IGST 5%', 'Out Put CGST 2.5%', 'Out Put SGST 2.5%', 'Roundoff']) x
       )
       select u.what as name, u.v as "tallyName", 'Not in Tally' as problem, null as hint
         from used u where not exists (select 1 from tally_name n where n.kind = u.kind and n.name = u.v)
        order by 1, 2`,
    ),
    query<{ name: string; channel: string | null; code: string | null }>(
      `select f.name, ch.channel, f.firm_code as code
         from fp_firm f left join fp_channel ch on ch.uid = f.channel_uid
        where f.active = 1 and coalesce(trim(f.tally_name), '') = ''
          and coalesce(ch.channel_code, '') not in ('RT', 'CO')
          and exists (select 1 from fp_booking_order b where b.from_firm_uid = f.uid and b.booking_time > now() - interval '90 days')
        order by ch.channel, f.name`,
    ),
  ]);
  return { counts, customers, products, others, noName };
}
