import type { Bill } from "./calc";

/**
 * The Tally import file, element for element what the workbook's macro wrote and Tally has been accepting: a Sales
 * voucher in Invoice view per bill, batches in the Plant godown, tax to the Output CGST/SGST or IGST ledgers. It only
 * creates vouchers; it doesn't touch ledger or stock masters, so those names have to exist in Tally already.
 */

export const TALLY_VOUCHER_COMPANY = "Vamaa Dairy Private Limited";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const money = (n: number) => n.toFixed(2);
const qtyText = (q: number) => (Number.isInteger(q) ? String(q) : String(Number(q.toFixed(4))));
const ymd = (d: string) => d.replace(/-/g, "");
const addressLines = (a: string | null) => (a ?? "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);

function voucher(b: Bill): string {
  const x: string[] = [];
  const t = (name: string, v: string) => x.push(`<${name}>${v}</${name}>`);
  const party = esc(b.ledger);
  const state = esc(b.state ?? "");

  x.push(`<TALLYMESSAGE xmlns:UDF="TallyUDF">`);
  x.push(`<VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Invoice Voucher View">`);
  t("DATE", ymd(b.voucherDate));
  t("EFFECTIVEDATE", ymd(b.voucherDate));
  t("VOUCHERNUMBER", esc(b.voucherNo));
  t("VOUCHERTYPENAME", "Sales");
  t("PARTYLEDGERNAME", party);
  t("PARTYNAME", party);
  t("BASICBASEPARTYNAME", party);
  t("BASICBUYERNAME", party);
  t("PARTYMAILINGNAME", party);
  t("STATENAME", state);
  t("PLACEOFSUPPLY", state);
  if (b.buyer.gstin) t("PARTYGSTIN", esc(b.buyer.gstin));
  if (b.buyer.pincode) t("PARTYPINCODE", esc(b.buyer.pincode));
  const buyerAddress = addressLines(b.buyer.address);
  if (buyerAddress.length) {
    x.push(`<BASICBUYERADDRESS.LIST TYPE="String">`);
    for (const a of buyerAddress) t("BASICBUYERADDRESS", esc(a));
    x.push(`</BASICBUYERADDRESS.LIST>`);
  }
  if (b.consignee) {
    const c = b.consignee;
    if (c.name) t("CONSIGNEEMAILINGNAME", esc(c.name));
    if (c.state) t("CONSIGNEESTATENAME", esc(c.state));
    if (c.pincode) t("CONSIGNEEPINCODE", esc(c.pincode));
    if (c.gstin) t("CONSIGNEEGSTIN", esc(c.gstin));
    const address = addressLines(c.address);
    if (address.length) {
      x.push(`<ADDRESS.LIST TYPE="String">`);
      for (const a of address) t("ADDRESS", esc(a));
      x.push(`</ADDRESS.LIST>`);
    }
  }
  t("PERSISTEDVIEW", "Invoice Voucher View");
  t("VCHENTRYMODE", "Item Invoice");
  t("ISINVOICE", "Yes");

  for (const l of b.lines) {
    const unit = esc(l.unit);
    const q = ` ${qtyText(l.qty)} ${unit}`;
    x.push(`<ALLINVENTORYENTRIES.LIST>`);
    t("STOCKITEMNAME", esc(l.item));
    t("ISDEEMEDPOSITIVE", "No");
    t("RATE", `${money(l.rate)}/${unit}`);
    t("AMOUNT", money(l.amount));
    t("ACTUALQTY", q);
    t("BILLEDQTY", q);
    x.push(`<BATCHALLOCATIONS.LIST>`);
    t("GODOWNNAME", "Plant");
    t("BATCHNAME", esc(l.batch ?? "Primary Batch"));
    if (l.expiry) t("EXPIRYDATE", ymd(l.expiry));
    t("AMOUNT", money(l.amount));
    t("ACTUALQTY", q);
    t("BILLEDQTY", q);
    x.push(`</BATCHALLOCATIONS.LIST>`);
    x.push(`<ACCOUNTINGALLOCATIONS.LIST>`);
    t("LEDGERNAME", esc(l.ledger));
    t("ISDEEMEDPOSITIVE", "No");
    t("AMOUNT", money(l.amount));
    x.push(`</ACCOUNTINGALLOCATIONS.LIST>`);
    x.push(`</ALLINVENTORYENTRIES.LIST>`);
  }

  x.push(`<LEDGERENTRIES.LIST>`);
  t("LEDGERNAME", party);
  t("ISDEEMEDPOSITIVE", "Yes");
  t("ISPARTYLEDGER", "Yes");
  t("AMOUNT", money(-b.total));
  x.push(`<BILLALLOCATIONS.LIST>`);
  t("NAME", esc(b.voucherNo));
  t("BILLTYPE", "New Ref");
  t("AMOUNT", money(-b.total));
  x.push(`</BILLALLOCATIONS.LIST>`);
  x.push(`</LEDGERENTRIES.LIST>`);

  const taxLedger = (name: string, amount: number) => {
    x.push(`<LEDGERENTRIES.LIST>`);
    t("LEDGERNAME", name);
    t("ISDEEMEDPOSITIVE", "No");
    t("ISPARTYLEDGER", "No");
    t("AMOUNT", money(amount));
    x.push(`</LEDGERENTRIES.LIST>`);
  };
  if (b.igst > 0) taxLedger("Output IGST 5%", b.igst);
  if (b.cgst > 0) {
    taxLedger("Out Put CGST 2.5%", b.cgst);
    taxLedger("Out Put SGST 2.5%", b.sgst);
  }
  if (Math.abs(b.roundoff) >= 0.005) {
    x.push(`<LEDGERENTRIES.LIST>`);
    t("LEDGERNAME", "Roundoff");
    t("ISPARTYLEDGER", "No");
    t("ISDEEMEDPOSITIVE", b.roundoff < 0 ? "Yes" : "No");
    t("AMOUNT", money(b.roundoff));
    x.push(`</LEDGERENTRIES.LIST>`);
  }
  x.push(`</VOUCHER>`);
  x.push(`</TALLYMESSAGE>`);
  return x.join("\r\n");
}

export function tallyXml(bills: Bill[], company = TALLY_VOUCHER_COMPANY): string {
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<ENVELOPE>`,
    `<HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>`,
    `<BODY><IMPORTDATA>`,
    `<REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME><STATICVARIABLES><SVCURRENTCOMPANY>${esc(company)}</SVCURRENTCOMPANY></STATICVARIABLES></REQUESTDESC>`,
    `<REQUESTDATA>`,
    ...bills.map(voucher),
    `</REQUESTDATA>`,
    `</IMPORTDATA></BODY>`,
    `</ENVELOPE>`,
  ].join("\r\n");
}
