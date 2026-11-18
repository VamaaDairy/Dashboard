import "server-only";
import ExcelJS from "exceljs";
import { listCreditNotes } from "./data";
import { applyFilter, type NoteFilter } from "./filters";
import { qtyText, statusLabel } from "./qty";

/**
 * Credit notes as an Excel workbook (issue #152): the notes whose challan date falls in [filter.from, filter.to],
 * narrowed by the page's other filters too.
 *   "Credit notes"  one row per returned item, with every detail of its note
 *   "Summary"       one row per challan: items, quantities claimed and approved, status
 * Quantities are given in pieces (or the item's own unit when counted singly), plus as written on the note ("2 CRT 5 Pcs").
 */
export async function creditNoteWorkbook(filter: NoteFilter): Promise<{ file: Buffer; count: number }> {
  const notes = applyFilter(await listCreditNotes(), filter).sort((a, b) => a.challan_date.localeCompare(b.challan_date) || a.challan_no.localeCompare(b.challan_no));

  const wb = new ExcelJS.Workbook();
  wb.creator = "Vamaa Dairy Dashboard";
  wb.created = new Date();
  const navy = "FF2F3992";
  const head = (ws: ExcelJS.Worksheet, row: number) => {
    const r = ws.getRow(row);
    r.font = { bold: true, color: { argb: "FFFFFFFF" } };
    r.fill = { type: "pattern", pattern: "solid", fgColor: { argb: navy } };
    r.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    r.height = 30;
  };
  const day = (d: string | null) => (d ? new Date(`${d}T00:00:00Z`) : null);
  const range = filter.from || filter.to ? `${filter.from || "start"} to ${filter.to || "today"}` : "all dates";
  const title = (ws: ExcelJS.Worksheet, cols: number, text: string) => {
    ws.mergeCells(1, 1, 1, cols);
    ws.getCell("A1").value = text;
    ws.getCell("A1").font = { bold: true, size: 14, color: { argb: navy } };
    ws.addRow([]);
  };

  // ---- one row per item
  const cols: Array<[string, number]> = [
    ["Challan No.", 14], ["Challan date", 13], ["Customer", 28], ["Contact", 13], ["Address", 32], ["Team", 14], ["Checked by", 16],
    ["Vehicle", 13], ["Dispatch challan", 15], ["Dispatch date", 13], ["Material", 32], ["SKU", 10], ["Reason", 20], ["MFD", 12], ["UBD", 12],
    ["Unit", 8], ["Pcs per case", 9], ["Claim (pcs / unit)", 12], ["Claim", 14], ["Approved (pcs / unit)", 12], ["Approved", 14],
    ["Quality remark", 24], ["Status", 10], ["Approved by", 16], ["Approved on", 13], ["Decision note", 24],
  ];
  const ws = wb.addWorksheet("Credit notes", { views: [{ state: "frozen", ySplit: 3, xSplit: 1 }] });
  ws.columns = cols.map(([, width]) => ({ width }));
  title(ws, cols.length, `VAMAA DAIRY PRIVATE LIMITED - Credit notes, ${range}`);
  ws.addRow(cols.map(([h]) => h));
  head(ws, 3);
  let lines = 0;
  for (const n of notes) {
    const items = n.items.length ? n.items : [null];
    for (const i of items) {
      if (i) lines++;
      ws.addRow([
        n.challan_no, day(n.challan_date), n.customer_name, n.contact_no, n.address, n.team_name, n.checked_by,
        n.vehicle_no, n.dispatch_challan_no, day(n.dispatch_date),
        i?.material_name ?? null, i?.sku_code ?? null, i?.reason ?? null, day(i?.mfd ?? null), day(i?.ubd ?? null),
        i?.return_unit ?? null, i ? i.pcs_per_case : null,
        i?.claim_qty ?? null, i ? qtyText(i.claim_qty, i.return_unit, i.pcs_per_case) || null : null,
        i?.approved_qty ?? null, i ? qtyText(i.approved_qty, i.return_unit, i.pcs_per_case) || null : null,
        i?.quality_remark ?? null, statusLabel(n), n.approved_by, day(n.approved_on), n.decision_note,
      ]);
    }
  }
  if (!notes.length) ws.addRow(["No credit notes in these dates."]);
  else {
    const last = ws.rowCount;
    const total = ws.addRow(["Total", null, `${notes.length} ${notes.length === 1 ? "credit note" : "credit notes"}, ${lines} ${lines === 1 ? "item" : "items"}`]);
    total.getCell(18).value = { formula: `SUM(R4:R${last})` };
    total.getCell(20).value = { formula: `SUM(T4:T${last})` };
    total.font = { bold: true };
    total.border = { top: { style: "thin" } };
    ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: last, column: cols.length } };
  }
  for (const c of [2, 10, 14, 15, 25]) ws.getColumn(c).numFmt = "dd-mmm-yyyy";
  for (const c of [18, 20]) ws.getColumn(c).numFmt = "#,##0.###";
  for (const c of [5, 22, 26]) ws.getColumn(c).alignment = { wrapText: true, vertical: "top" };

  // ---- one row per challan
  const sc: Array<[string, number]> = [
    ["Challan No.", 14], ["Challan date", 13], ["Customer", 30], ["Team", 14], ["Items", 8], ["Claimed (pcs / unit)", 14], ["Approved (pcs / unit)", 14],
    ["Status", 10], ["Approved by", 16], ["Approved on", 13],
  ];
  const ss = wb.addWorksheet("Summary", { views: [{ state: "frozen", ySplit: 3 }] });
  ss.columns = sc.map(([, width]) => ({ width }));
  title(ss, sc.length, `Credit notes by challan, ${range}`);
  ss.addRow(sc.map(([h]) => h));
  head(ss, 3);
  const sum = (xs: Array<number | null>) => xs.reduce<number>((s, v) => s + Number(v ?? 0), 0);
  for (const n of notes) {
    ss.addRow([
      n.challan_no, day(n.challan_date), n.customer_name, n.team_name, n.items.length,
      sum(n.items.map((i) => i.claim_qty)), n.items.some((i) => i.approved_qty !== null) ? sum(n.items.map((i) => i.approved_qty)) : null,
      statusLabel(n), n.approved_by, day(n.approved_on),
    ]);
  }
  if (notes.length) {
    const last = ss.rowCount;
    const t = ss.addRow(["Total", null, null, null, { formula: `SUM(E4:E${last})` }, { formula: `SUM(F4:F${last})` }, { formula: `SUM(G4:G${last})` }]);
    t.font = { bold: true };
    t.border = { top: { style: "thin" } };
    // how many of each status
    ss.addRow([]);
    for (const s of ["Pending", "Approved", "Rejected"]) ss.addRow([s, null, notes.filter((n) => statusLabel(n) === s).length]).font = { bold: s === "Approved" };
  }
  for (const c of [2, 10]) ss.getColumn(c).numFmt = "dd-mmm-yyyy";
  for (const c of [6, 7]) ss.getColumn(c).numFmt = "#,##0.###";

  return { file: Buffer.from(await wb.xlsx.writeBuffer()), count: notes.length };
}
