/**
 * Turns a day's order lines into Tally sales vouchers. Pure, so it can be checked on its own. The rules are the ones
 * the demand-sheet workbook's Day Book macro used:
 *  - app rates are per piece with GST; a line is billed in the product's Tally unit (crates, boxes...) at the case rate
 *    without GST, so 40 packets of a 24-to-a-crate milk is 1.6667 CRT;
 *  - each outlet has its own voucher, except stockists: one voucher per ledger, milk and everything else apart;
 *  - batches are given earliest expiry first; MFS only takes a batch with more than 75% of its shelf life left.
 */

export const COMPANY_STATE = "Chhattisgarh";
export const PRIMARY_BATCH = "Primary Batch";

export const r2 = (n: number) => Math.round((n + Number.EPSILON * Math.sign(n)) * 100) / 100;

export interface BillParty {
  id: number;
  name: string;
  channel: string;
  tally_ledger: string | null;
  state: string | null;
  consignee_name: string | null;
  consignee_address: string | null;
  consignee_state: string | null;
  consignee_pincode: string | null;
  consignee_gstin: string | null;
  buyer_address: string | null;
  buyer_gstin: string | null;
  buyer_pincode: string | null;
  consolidated: boolean;
  review_note: string | null;
}

export interface BillProduct {
  sku_no: number;
  name: string;
  tally_item: string | null;
  tally_ledger: string | null;
  tally_unit: string | null;
  pack_size: number;
  gst_pct: number;
  shelf_days: number;
  stock_id: string | null;
  sort: number;
}

export interface BillInputLine {
  orderUid: string;
  firmName: string;
  routeName: string | null;
  sku: string;
  skuName: string;
  /** pieces */
  qty: number;
  /** per piece, GST included */
  rate: number;
  party: BillParty | null;
  product: BillProduct | null;
}

export interface VoucherLine {
  name: string;
  item: string;
  ledger: string;
  unit: string;
  gst: number;
  /** in the Tally unit */
  qty: number;
  /** per Tally unit, without GST */
  rate: number;
  amount: number;
  pieces: number;
  stockId: string | null;
  shelfDays: number;
  batch: string | null;
  /** yyyy-mm-dd */
  expiry: string | null;
}

export interface Totals {
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  roundoff: number;
  total: number;
}

export interface DraftBill extends Totals {
  key: string;
  partyId: number | null;
  partyName: string;
  ledger: string;
  routeName: string | null;
  channel: string | null;
  state: string | null;
  interstate: boolean;
  isMfs: boolean;
  /** MILK / OTHER on a stockist's two bills */
  part: string | null;
  buyer: { address: string | null; gstin: string | null; pincode: string | null };
  consignee: { name: string | null; address: string | null; state: string | null; pincode: string | null; gstin: string | null } | null;
  lines: VoucherLine[];
  orderUids: string[];
  /** what stops this bill being made until the masters are fixed */
  issues: string[];
  warnings: string[];
}

export interface Bill extends DraftBill {
  voucherNo: string;
  voucherDate: string;
}

export function totalsOf(lines: Array<Pick<VoucherLine, "amount" | "gst">>, interstate: boolean): Totals {
  const taxable = r2(lines.reduce((s, l) => s + l.amount, 0));
  const half = r2(lines.reduce((s, l) => s + (l.amount * l.gst) / 200, 0));
  const gross = taxable + half + half;
  const total = Math.round(gross);
  return {
    taxable,
    cgst: interstate ? 0 : half,
    sgst: interstate ? 0 : half,
    igst: interstate ? r2(half + half) : 0,
    roundoff: r2(total - gross),
    total,
  };
}

const lineOf = (l: BillInputLine, p: BillProduct): VoucherLine => {
  const pack = Number(p.pack_size) > 0 ? Number(p.pack_size) : 1;
  const gst = Number(p.gst_pct);
  const qty = l.qty / pack;
  const rate = r2((l.rate * pack) / (1 + gst / 100));
  return {
    name: p.name, item: p.tally_item!, ledger: p.tally_ledger!, unit: p.tally_unit!, gst, qty, rate,
    amount: r2(qty * rate), pieces: l.qty, stockId: p.stock_id, shelfDays: Number(p.shelf_days), batch: null, expiry: null,
  };
};

/** Adds a line to a voucher, or to the line already there for the same item at the same rate. */
function addLine(lines: VoucherLine[], add: VoucherLine) {
  const same = lines.find((x) => x.item === add.item && x.rate === add.rate);
  if (!same) { lines.push(add); return; }
  same.pieces += add.pieces;
  same.qty += add.qty;
  same.amount = r2(same.qty * same.rate);
}

export function buildDrafts(input: BillInputLine[]): DraftBill[] {
  const bills = new Map<string, DraftBill>();
  const sortOf = new Map<string, number>();

  for (const l of input) {
    const pt = l.party;
    const ledger = pt?.tally_ledger?.trim() ? pt.tally_ledger : null;
    const p = l.product;
    const part = pt?.consolidated && ledger ? (p?.tally_ledger?.toLowerCase().includes("milk") ? "MILK" : "OTHER") : null;
    const key = part ? `ledger:${ledger!.toLowerCase()}:${part}` : pt ? `party:${pt.id}` : `firm:${l.firmName}`;
    let b = bills.get(key);
    if (!b) {
      const state = pt?.state?.trim() || null;
      b = {
        key,
        partyId: part ? null : pt?.id ?? null,
        partyName: part ? ledger! : pt?.name ?? l.firmName,
        ledger: ledger ?? "",
        routeName: l.routeName,
        channel: pt?.channel ?? null,
        state,
        interstate: !!state && state.toUpperCase() !== COMPANY_STATE.toUpperCase(),
        isMfs: pt?.channel === "MFS",
        part,
        buyer: { address: pt?.buyer_address ?? null, gstin: pt?.buyer_gstin ?? null, pincode: pt?.buyer_pincode ?? null },
        consignee: !pt || part ? null : {
          name: pt.consignee_name, address: pt.consignee_address, state: pt.consignee_state, pincode: pt.consignee_pincode, gstin: pt.consignee_gstin,
        },
        lines: [],
        orderUids: [],
        issues: [],
        warnings: [],
        taxable: 0, cgst: 0, sgst: 0, igst: 0, roundoff: 0, total: 0,
      };
      if (!pt) b.issues.push(`"${l.firmName}" is not matched to a customer`);
      else {
        if (!ledger) b.issues.push(`${pt.name} has no Tally ledger`);
        if (!state) b.issues.push(`${pt.name} has no state, so CGST/SGST or IGST can't be chosen`);
        if (pt.review_note && !part) b.warnings.push(pt.review_note);
      }
      bills.set(key, b);
    }
    if (!b.orderUids.includes(l.orderUid)) b.orderUids.push(l.orderUid);

    if (!p) { b.issues.push(`SKU ${l.sku} (${l.skuName}) is not in the product master`); continue; }
    if (!p.tally_item || !p.tally_ledger || !p.tally_unit) { b.issues.push(`${p.name} has no Tally stock item, ledger or unit`); continue; }
    sortOf.set(p.tally_item, Number(p.sort));
    addLine(b.lines, lineOf(l, p));
  }

  const out = [...bills.values()];
  for (const b of out) {
    b.issues = [...new Set(b.issues)];
    b.warnings = [...new Set(b.warnings)];
    b.lines.sort((x, y) => (sortOf.get(x.item) ?? 0) - (sortOf.get(y.item) ?? 0));
    Object.assign(b, totalsOf(b.lines, b.interstate));
  }
  return out.sort((a, b) => (a.routeName ?? "~").localeCompare(b.routeName ?? "~") || a.partyName.localeCompare(b.partyName) || (a.part ?? "").localeCompare(b.part ?? ""));
}

// ---------------------------------------------------------------- batches

export interface StockBatch {
  no: string;
  /** yyyy-mm-dd, when known */
  ubd: string | null;
  pieces: number;
  shelfDays: number;
}

export const addDays = (ymd: string, days: number) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const dayDiff = (a: string, b: string) => (Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;

/**
 * Splits a voucher's lines over batches, taking the pieces out of [pool] (batches earliest expiry first, by stock id).
 * What no batch can cover stays on Primary Batch and the bill says so. With [pool] null (stock API unreachable) every
 * line is on Primary Batch.
 */
export function allocateBatches(bill: DraftBill, pool: Map<string, StockBatch[]> | null, voucherDate: string): DraftBill {
  const lines: VoucherLine[] = [];
  const warnings = [...bill.warnings];

  for (const l of bill.lines) {
    const pack = l.pieces / l.qty;
    const part = (pieces: number, batch: string, expiry: string): VoucherLine => {
      const qty = pieces / pack;
      return { ...l, pieces, qty, amount: r2(qty * l.rate), batch, expiry };
    };
    const batches = (l.stockId && pool?.get(l.stockId)) || [];
    let left = l.pieces;
    for (const b of batches) {
      if (left <= 0.0001) break;
      if (b.pieces <= 0.0001) continue;
      if (bill.isMfs && b.shelfDays > 0) {
        if (!b.ubd || (dayDiff(b.ubd, voucherDate) / b.shelfDays) * 100 <= 75) continue;
      }
      const give = Math.min(b.pieces, left);
      b.pieces -= give;
      left -= give;
      lines.push(part(give, b.no, b.ubd ?? addDays(voucherDate, l.shelfDays)));
    }
    if (left > 0.0001) {
      lines.push(part(left, PRIMARY_BATCH, addDays(voucherDate, l.shelfDays)));
      warnings.push(`${l.name}: ${left} pieces on ${PRIMARY_BATCH}${bill.isMfs ? " (no batch with over 75% shelf life)" : pool ? " (not enough stock in batches)" : " (stock API unreachable)"}`);
    }
  }
  return { ...bill, lines, warnings: [...new Set(warnings)], ...totalsOf(lines, bill.interstate) };
}

/** A voucher balances when its sales, tax and round-off add up to what the party owes. */
export const balanced = (b: Totals) => Math.abs(b.taxable + b.cgst + b.sgst + b.igst + b.roundoff - b.total) < 0.011;
