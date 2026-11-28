/**
 * Self-test for the distributor ledger read from Tally (src/lib/distributor/ledger.ts) against a stand-in Tally, on the
 * local database, plus billing a customer straight from the Customer Master (src/lib/route-orders/calc.ts).
 *
 *   npx tsx --conditions=react-server db/dist-ledger-selftest.ts
 */
import http from "node:http";
import { config } from "dotenv";
config({ path: ".env.local" });
if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "")) throw new Error("Local database only.");

const LEDGER = "ZZ Ledger Test Traders";
let tallyUp = true;
let voucherCalls = 0;

function answer(req: string) {
  const env = (b: string) => `<ENVELOPE>${b}</ENVELOPE>`;
  if (req.includes("<ID>BSGroups</ID>")) return env(`<GROUP NAME="Sundry Debtors"><PARENT>Current Assets</PARENT><CLOSINGBALANCE>-1000.00</CLOSINGBALANCE></GROUP>`);
  if (req.includes("<ID>BSLedgers</ID>"))
    // Tally: a debit (owed to us) is negative - this party owes 12,500
    return env(`<LEDGER NAME="${LEDGER}"><PARENT>Sundry Debtors</PARENT><CLOSINGBALANCE>-12500.00</CLOSINGBALANCE><EMAIL></EMAIL><LEDGERPHONE></LEDGERPHONE></LEDGER>`);
  if (req.includes("<ID>Ledger Vouchers</ID>")) {
    voucherCalls++;
    const month = /<SVTODATE TYPE="Date">\d+-(\w{3})-/.exec(req)?.[1];
    if (month !== "Nov") return env("");
    return env([
      `<DSPVCHDATE>3-Nov-26</DSPVCHDATE><DSPVCHLEDACCOUNT>Milk Sales</DSPVCHLEDACCOUNT><DSPVCHTYPE>Sales</DSPVCHTYPE><DSPVCHDRAMT>-10000.00</DSPVCHDRAMT><DSPVCHCRAMT></DSPVCHCRAMT>`,
      `<DSPVCHDATE>10-Nov-26</DSPVCHDATE><DSPVCHLEDACCOUNT>HDFC Bank</DSPVCHLEDACCOUNT><DSPVCHTYPE>Receipt</DSPVCHTYPE><DSPVCHDRAMT></DSPVCHDRAMT><DSPVCHCRAMT>6000.00</DSPVCHCRAMT>`,
      `<DSPVCHDATE>12-Nov-26</DSPVCHDATE><DSPVCHLEDACCOUNT>Sales Return</DSPVCHLEDACCOUNT><DSPVCHTYPE>Credit Note</DSPVCHTYPE><DSPVCHDRAMT></DSPVCHDRAMT><DSPVCHCRAMT>500.00</DSPVCHCRAMT>`,
    ].join(""));
  }
  return env("");
}

let failed = 0;
const check = (ok: boolean, what: string) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) failed++; };

async function main() {
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      if (!tallyUp) { res.writeHead(500); res.end(); return; }
      res.writeHead(200, { "Content-Type": "text/xml" }); res.end(answer(body));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  process.env.TALLY_URL = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const { query } = await import("../src/lib/db");
  const { distLedger } = await import("../src/lib/distributor/ledger");
  const { buildDrafts } = await import("../src/lib/route-orders/calc");
  await query(`delete from tally_ledger_cache where ledger = $1`, [LEDGER]);
  try {
    const l = await distLedger(LEDGER, 1);
    check(!!l && l.closing === 12500, `owes now: ${l?.closing}`);
    check(!!l && l.totals.debit === 10000 && l.totals.credit === 6500, `period: billed ${l?.totals.debit}, paid/credited ${l?.totals.credit}`);
    check(!!l && l.opening === 9000, `opening = closing - (billed - paid): ${l?.opening}`);
    check(!!l && l.entries.map((e) => e.balance).join(",") === "19000,13000,12500", `running balance: ${l?.entries.map((e) => e.balance).join(", ")}`);
    check(!!l && l.entries[0].date === "2026-11-03" && l.entries[1].type === "Receipt" && l.entries[2].type === "Credit Note", "dates and voucher types");
    check(!!l && !l.stale, "fresh from Tally");

    const calls = voucherCalls;
    const again = await distLedger(LEDGER, 1);
    check(voucherCalls === calls && again?.closing === 12500, "a second read within 15 minutes uses the kept copy");

    await query(`update tally_ledger_cache set read_at = now() - interval '1 hour' where ledger = $1`, [LEDGER]);
    tallyUp = false;
    const down = await distLedger(LEDGER, 1);
    check(!!down && down.stale && down.closing === 12500, "Tally down: the last copy, marked stale");
    const none = await distLedger("ZZ Ledger Test Nobody", 1);
    check(none === null, "Tally down and never read: nothing");
    tallyUp = true;

    // billing straight from the Customer Master: a party with no route-sheet id is its own bill, by firm
    const party = { id: null, name: "New Dist", tally_ledger: "New Dist Ledger", state: "Chhattisgarh", channel: "GT", consolidated: false,
      review_note: null, buyer_address: null, buyer_gstin: null, buyer_pincode: null, consignee_name: "New Dist", consignee_address: null,
      consignee_state: null, consignee_pincode: null, consignee_gstin: null };
    const product = { name: "Milk", tally_item: "Milk Item", tally_ledger: "Milk Sales", tally_unit: "CRT", pack_size: 24, gst_pct: 0, shelf_days: 2, stock_id: null, sort: 1 };
    const line = (firmUid: string, name: string) => ({ orderUid: `o-${firmUid}`, firmUid, firmName: name, routeName: null, sku: "1", skuName: "milk", qty: 24, rate: 30, party: { ...party, name, tally_ledger: `${name} Ledger` }, product });
    const drafts = buildDrafts([line("f1", "New Dist A"), line("f2", "New Dist B")] as never);
    check(drafts.length === 2 && drafts.every((d) => !d.issues.length), `two Customer Master customers: two bills, ready (${drafts.map((d) => d.ledger).join(", ")})`);
    const noName = buildDrafts([{ ...line("f3", "No Name"), party: null }] as never);
    check(noName[0]?.issues[0]?.includes("has no Tally name"), `no Tally name: held (${noName[0]?.issues[0]})`);
  } finally {
    await query(`delete from tally_ledger_cache where ledger like 'ZZ Ledger Test%'`);
    server.close();
  }
  console.log(failed ? `${failed} FAILED` : "all passed");
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
