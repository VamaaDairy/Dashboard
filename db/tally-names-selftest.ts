/**
 * Self-test for reading Tally's names (src/lib/tally/names.ts) against a stand-in Tally: a local HTTP server that
 * answers the four export requests with sample ledgers, stock items and units. Runs on the local database; adds its
 * own test customers and products (names starting "ZZ Tally Test") and removes them at the end.
 *
 *   npx tsx --conditions=react-server db/tally-names-selftest.ts
 */
import http from "node:http";
import { config } from "dotenv";
config({ path: ".env.local" });
if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "")) throw new Error("Local database only.");

const LEDGERS = [
  ["ZZ Tally Test Apna Mart", "Sundry Debtors", ""],
  ["ZZ Tally Test M.P.S Agency", "ZZ Tally Test GT", ""],
  ["ZZ Tally Test Gst Traders Pvt Ltd", "ZZ Tally Test GT", "22AAAAA0000A1Z5"],
  ["ZZ Tally Test Same Name Dairy", "Sundry Debtors", ""],
  ["ZZ Tally Test Sales Ledger", "Sales Accounts", ""],
];
const ITEMS = [["ZZ Tally Test Paneer 200gms", "PCS"], ["ZZ Tally Test Ghee 1 Ltr", "PCS"]];

const xml = (body: string) => `<ENVELOPE><HEADER><VERSION>1</VERSION><STATUS>1</STATUS></HEADER><BODY><DATA><COLLECTION>${body}</COLLECTION></DATA></BODY></ENVELOPE>`;
const amp = (s: string) => s.replace(/&/g, "&amp;");
function answer(req: string) {
  if (req.includes("<ID>TNGroups</ID>")) return xml(`<GROUP NAME="Sundry Debtors"><PARENT>Current Assets</PARENT></GROUP><GROUP NAME="ZZ Tally Test GT"><PARENT>Sundry Debtors</PARENT></GROUP><GROUP NAME="Sales Accounts"><PARENT></PARENT></GROUP>`);
  if (req.includes("<ID>TNLedgers</ID>"))
    return xml(LEDGERS.map(([n, p, g]) => `<LEDGER NAME="${amp(n)}" RESERVEDNAME=""><PARENT>${amp(p)}</PARENT>${g ? `<LEDGSTREGDETAILS.LIST><GSTIN>${g}</GSTIN></LEDGSTREGDETAILS.LIST>` : ""}</LEDGER>`).join(""));
  if (req.includes("<ID>TNItems</ID>")) return xml(ITEMS.map(([n, u]) => `<STOCKITEM NAME="${amp(n)}"><BASEUNITS>${u}</BASEUNITS></STOCKITEM>`).join(""));
  if (req.includes("<ID>TNUnits</ID>")) return xml(`<UNIT NAME="PCS"></UNIT>`);
  return xml("");
}

let failed = 0;
const check = (ok: boolean, what: string) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) failed++; };

async function main() {
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => { res.writeHead(200, { "Content-Type": "text/xml" }); res.end(answer(body)); });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  process.env.TALLY_URL = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

  const { query, one } = await import("../src/lib/db");
  const { readTallyNames, tallyCheck } = await import("../src/lib/tally/names");
  const clean = async () => {
    await query(`delete from fp_firm where name like 'ZZ Tally Test%'`);
    await query(`delete from fp_product where sku_name like 'ZZ Tally Test%'`);
  };
  await clean();
  const tax = await one<{ uid: string }>(`select uid from fp_tax_configuration limit 1`);
  const firm = (name: string, tally: string | null, gstin: string | null) =>
    query(`insert into fp_firm (name, firm_code, country_code, active, parents, sales_report_mapping, tally_name, gstin) values ($1, $2, 91, 1, '', '', $3, $4)`,
      [name, `ZZT${Math.random().toString(36).slice(2, 8)}`, tally, gstin]);
  await firm("ZZ Tally Test Apna Mart Raipur", "ZZ Tally Test Apna  Mart", null);    // two spaces: Tally's spelling wins
  await firm("ZZ Tally Test GST Customer", null, "22AAAAA0000A1Z5");                // no name: found by GSTIN
  await firm("ZZ Tally Test Same Name Dairy", null, null);                           // no name: found by the same name
  await firm("ZZ Tally Test Unknown", "ZZ Tally Test Not In Tally", null);           // stays, and is listed
  const product = (name: string, tally: string | null) =>
    query(`insert into fp_product (model_number, brand, category, sub_category, model_name, sku_code, sku_name, mrp, dp, variant, tax_configuration_uid, active, tally_name)
           values ($1, 'Gaia', 'Test', 'Test', $2, $1, $2, 1, 1, '', $3, 1, $4)`, [`ZZT${Math.random().toString(36).slice(2, 7)}`, name, tax?.uid, tally]);
  await product("ZZ Tally Test Ghee 1 Ltr", null);                                    // no name: found by the same name
  await product("ZZ Tally Test Paneer", "ZZ Tally Test Paneer 200 Gms");              // spacing: Tally's spelling wins
  await product("ZZ Tally Test Paneer Box", "ZZ Tally Test Paneer");                  // not in Tally, listed with a hint

  try {
    const r = await readTallyNames("selftest");
    check(r.ledgers === LEDGERS.length && r.items === ITEMS.length && r.units === 1, `read ${r.ledgers} ledgers, ${r.items} items, ${r.units} unit`);
    check(r.debtors === 4, `ledgers under Sundry Debtors (also through a sub-group): ${r.debtors}`);
    const name = async (n: string) => (await one<{ tally_name: string | null }>(`select tally_name from fp_firm where name = $1`, [n]))?.tally_name;
    check((await name("ZZ Tally Test Apna Mart Raipur")) === "ZZ Tally Test Apna Mart", "spacing fixed to Tally's exact spelling");
    check((await name("ZZ Tally Test GST Customer")) === "ZZ Tally Test Gst Traders Pvt Ltd", "blank filled by GSTIN");
    check((await name("ZZ Tally Test Same Name Dairy")) === "ZZ Tally Test Same Name Dairy", "blank filled by the same name");
    check((await name("ZZ Tally Test Unknown")) === "ZZ Tally Test Not In Tally", "a name Tally doesn't have is left as it is");
    const ghee = await one<{ tally_name: string | null }>(`select tally_name from fp_product where sku_name = 'ZZ Tally Test Ghee 1 Ltr'`);
    check(ghee?.tally_name === "ZZ Tally Test Ghee 1 Ltr", "product blank filled by the same name");
    const paneerName = await one<{ tally_name: string | null }>(`select tally_name from fp_product where sku_name = 'ZZ Tally Test Paneer'`);
    check(paneerName?.tally_name === "ZZ Tally Test Paneer 200gms", "product spelling fixed to Tally's");
    check(r.filled.some((f) => f.from === "ZZ Tally Test Apna  Mart" && f.to === "ZZ Tally Test Apna Mart"), "the read lists the old and new spelling");

    const c = await tallyCheck();
    check(c.customers.some((x) => x.tallyName === "ZZ Tally Test Not In Tally"), "check lists the customer whose Tally name isn't in Tally");
    check(!c.customers.some((x) => x.name.startsWith("ZZ Tally Test Apna")), "check doesn't list the corrected one");
    const paneer = c.products.find((x) => x.tallyName === "ZZ Tally Test Paneer");
    check(!!paneer && paneer.hint === "ZZ Tally Test Paneer 200gms", `check lists the product with the closest Tally name (${paneer?.hint})`);
  } finally {
    await clean();
    await query(`delete from tally_name_read where read_by = 'selftest'`);
    server.close();
  }
  console.log(failed ? `${failed} FAILED` : "all passed");
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
