import "server-only";

/**
 * Balance Sheet tree (Sundry Debtors) straight from Tally's HTTP/XML server (port 9000).
 *
 * Two pulls: Groups (the branches, e.g. Sundry Debtors > MFS) and Ledgers (the leaves, i.e. the parties).
 * A group's ClosingBalance already includes everything beneath it, so a parent is never re-summed
 * from its children.
 *
 * The Bills collection is deliberately NOT used: it is the bill-reference master, lists every
 * reference ever created with its face value and does not reflect settlement, so totals taken
 * from it overstate what is owed. Ledger closing balances are the figures that reconcile.
 *
 * Tally exports a debit as a negative number, so a receivable is negative in the raw data.
 */

export const TALLY_URL = process.env.TALLY_URL || "http://localhost:9000";
export const TALLY_COMPANY = process.env.TALLY_COMPANY || "Vamaa Dairy Private Limited 22-23 - (from 1-Apr-23)";
export const DEBTORS_ROOT = "Sundry Debtors";

export class TallyError extends Error {}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function decode(raw: string): string {
  return raw
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&")
    .replace(/[\x00-\x1f]/g, "")
    .trim();
}

const tag = (chunk: string, name: string) => {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([^<]*)</${name}>`).exec(chunk);
  return m ? decode(m[1]) : "";
};
const num = (s: string) => {
  const n = parseFloat(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

async function post(xml: string, timeoutMs = 120_000, attempts = 3): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(TALLY_URL, {
        method: "POST",
        headers: { "Content-Type": "text/xml" },
        body: xml,
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
      if (!res.ok) throw new TallyError(`Tally responded with HTTP ${res.status}.`);
      const body = await res.text();
      const err = /<LINEERROR>([^<]*)<\/LINEERROR>/.exec(body);
      if (err) throw new TallyError(`Tally error: ${decode(err[1])}`);
      return body;
    } catch (e) {
      lastErr = e;
      if (e instanceof TallyError && !/HTTP/.test(e.message)) throw e;
      if (attempt < attempts) await new Promise((r) => setTimeout(r, 700 * attempt));
    }
  }
  if (lastErr instanceof TallyError) throw lastErr;
  throw new TallyError(`Could not reach Tally at ${TALLY_URL}. Is TallyServer running on port 9000 with "${TALLY_COMPANY}" open?`);
}

function collection(id: string, type: string, fetch: string[]) {
  return `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>EXPORT</TALLYREQUEST><TYPE>COLLECTION</TYPE><ID>${id}</ID></HEADER><BODY><DESC>
<STATICVARIABLES><SVCURRENTCOMPANY>${esc(TALLY_COMPANY)}</SVCURRENTCOMPANY><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES>
<TDL><TDLMESSAGE><COLLECTION NAME="${id}" ISMODIFY="No"><TYPE>${type}</TYPE>${fetch.map((f) => `<FETCH>${f}</FETCH>`).join("")}</COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
}

const chunks = (body: string, el: string) => body.match(new RegExp(`<${el}\\s[\\s\\S]*?</${el}>`, "g")) ?? [];
const attrName = (chunk: string) => {
  const m = /NAME="([^"]*)"/.exec(chunk);
  return m ? decode(m[1]) : "";
};

export interface DebtorGroup {
  name: string;
  /** "" for the root */
  parent: string;
  /** debit-positive: what the group's parties owe */
  balance: number;
}

export interface DebtorLedger {
  name: string;
  parent: string;
  /** debit-positive: what the party owes */
  balance: number;
  email: string;
  phone: string;
}

export interface DebtorTree {
  fetchedAt: number;
  company: string;
  groups: DebtorGroup[];
  ledgers: DebtorLedger[];
}

async function fetchTree(): Promise<DebtorTree> {
  // one at a time: Tally's gateway serves a single request at once and hangs under concurrent hits
  const gBody = await post(collection("BSGroups", "Group", ["Name", "Parent", "ClosingBalance"]));
  const lBody = await post(collection("BSLedgers", "Ledger", ["Name", "Parent", "ClosingBalance", "Email", "LedgerPhone"]));
  if (!gBody.includes("<GROUP")) throw new TallyError(`Tally returned no groups. Is "${TALLY_COMPANY}" open in Tally?`);

  const allGroups = chunks(gBody, "GROUP").map((c) => ({
    name: attrName(c),
    parent: tag(c, "PARENT"),
    balance: -num(tag(c, "CLOSINGBALANCE")),
  }));

  // Sundry Debtors plus every group beneath it
  const byParent = new Map<string, string[]>();
  for (const g of allGroups) byParent.set(g.parent, [...(byParent.get(g.parent) ?? []), g.name]);
  const keep = new Set<string>();
  const queue = [DEBTORS_ROOT];
  while (queue.length) {
    const n = queue.shift() as string;
    if (keep.has(n)) continue;
    keep.add(n);
    queue.push(...(byParent.get(n) ?? []));
  }

  // a ledger and a group may share a name: first one seen wins
  const seen = new Set<string>();
  const groups = allGroups.filter((g) => keep.has(g.name) && !seen.has(g.name) && seen.add(g.name));
  seen.clear();
  const ledgers = chunks(lBody, "LEDGER")
    .map((c) => ({
      name: attrName(c),
      parent: tag(c, "PARENT"),
      balance: -num(tag(c, "CLOSINGBALANCE")),
      email: tag(c, "EMAIL"),
      phone: tag(c, "LEDGERPHONE"),
    }))
    .filter((l) => keep.has(l.parent) && !seen.has(l.name) && seen.add(l.name));

  return { fetchedAt: Date.now(), company: TALLY_COMPANY, groups, ledgers };
}

const TTL_MS = 5 * 60_000;
const cache = globalThis as unknown as { __osTree?: { at: number; tree: Promise<DebtorTree> } };

export async function getTree(force = false): Promise<DebtorTree> {
  const hit = cache.__osTree;
  if (!force && hit && Date.now() - hit.at < TTL_MS) return hit.tree;
  // a refresh already in flight is shared, so clicking twice never queues two pulls on Tally
  if (force && hit && Date.now() - hit.at < 5_000) return hit.tree;

  const tree = fetchTree();
  cache.__osTree = { at: Date.now(), tree };
  tree.catch(() => {
    if (cache.__osTree?.tree === tree) delete cache.__osTree;
  });
  return tree;
}

// ------------------------------------------------------------------ ledger vouchers

export interface LedgerVoucher {
  date: string;
  voucherType: string;
  /** The other ledger in that line's entry (the report has no narration or voucher number). */
  narration: string;
  /** Raw Tally amount for this ledger's own line: negative is a debit. */
  amount: number;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const toTallyDate = (d: Date) => `${d.getDate()}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;

/**
 * One request per calendar month in [from, to], each spanning the whole month: Tally's Ledger Vouchers
 * report ignores SVFROMDATE and only honours SVTODATE, so the real start is applied afterwards in JS.
 */
function monthRanges(from: Date, to: Date) {
  const out: { from: Date; to: Date }[] = [];
  for (let c = new Date(from.getFullYear(), from.getMonth(), 1); c <= to; c = new Date(c.getFullYear(), c.getMonth() + 1, 1)) {
    const end = new Date(c.getFullYear(), c.getMonth() + 1, 0);
    out.push({ from: c, to: end < to ? end : to });
  }
  return out;
}

async function vouchersForMonth(ledger: string, from: Date, to: Date): Promise<LedgerVoucher[]> {
  const xml = `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Data</TYPE><ID>Ledger Vouchers</ID></HEADER><BODY><DESC><STATICVARIABLES>
<SVCURRENTCOMPANY>${esc(TALLY_COMPANY)}</SVCURRENTCOMPANY><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
<SVFROMDATE TYPE="Date">${toTallyDate(from)}</SVFROMDATE><SVTODATE TYPE="Date">${toTallyDate(to)}</SVTODATE><LedgerName>${esc(ledger)}</LedgerName>
</STATICVARIABLES></DESC></BODY></ENVELOPE>`;
  // interactive path: fail fast rather than leave the page spinning when Tally's gateway is stuck
  const body = await post(xml, 30_000, 2);
  // a flat run of sibling tags per line: DSPVCHDATE, DSPVCHLEDACCOUNT, DSPVCHTYPE, DSPVCHDRAMT (already negative), DSPVCHCRAMT
  const entries = body.match(/<DSPVCHDATE>[\s\S]*?(?=<DSPVCHDATE>|<\/ENVELOPE>)/g) ?? [];
  return entries.map((c) => {
    const dr = tag(c, "DSPVCHDRAMT");
    return {
      date: tag(c, "DSPVCHDATE"),
      voucherType: tag(c, "DSPVCHTYPE"),
      narration: tag(c, "DSPVCHLEDACCOUNT"),
      amount: dr ? num(dr) : num(tag(c, "DSPVCHCRAMT")),
    };
  });
}

/** A party's ledger lines for an inclusive date range (calendar dates; time of day is ignored). */
export async function fetchLedgerVouchers(ledger: string, from: Date, to: Date): Promise<LedgerVoucher[]> {
  const all: LedgerVoucher[] = [];
  // one at a time: Tally's gateway serves a single request at once
  for (const r of monthRanges(from, to)) all.push(...(await vouchersForMonth(ledger, r.from, r.to)));
  return all.filter((v) => {
    const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/.exec(v.date.trim());   // the report prints a 2-digit year
    const mi = m ? MONTHS.indexOf(m[2]) : -1;
    if (!m || mi < 0) return true;   // unrecognised: keep rather than silently drop real data
    const d = new Date(2000 + Number(m[3]), mi, Number(m[1]));
    return d >= from && d <= to;
  });
}
